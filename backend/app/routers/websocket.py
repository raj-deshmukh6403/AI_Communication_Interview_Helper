"""
websocket.py
============
WebSocket endpoint for real-time interview sessions.

Changes from original:
  - answer handler: uses get_answer_snapshot() not get_session_summary()
  - answer handler: uses reset_answer() not reset() between questions
  - answer handler: pre-scoring via AnswerScorer before LLM evaluation
  - answer handler: decide_next_action() for server-side follow-up decisions
  - answer handler: tracks follow_ups_given per question
  - answer handler: saves question_number, pre_score, llm_score to MongoDB
  - end_session: saves AnalyticsModel to analytics collection
  - All other logic kept exactly as original
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import Dict, Optional
import json
import asyncio
from datetime import datetime
from bson import ObjectId

from ..database import get_database
from ..services.real_time_monitor import RealTimeMonitor
from ..services.llm_service import LLMService
from ..services.feedback_generator import FeedbackGenerator
from ..services.answer_scorer import AnswerScorer
from ..utils.auth import decode_access_token

router = APIRouter()

# Store active WebSocket connections and monitors
active_connections: Dict[str, WebSocket] = {}
session_monitors:   Dict[str, RealTimeMonitor] = {}


# ─────────────────────────── Connection manager ──────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections for real-time interview sessions."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        
        # ← ADD THIS: close existing connection if any
        if session_id in self.active_connections:
            try:
                old_ws = self.active_connections[session_id]
                await old_ws.close(code=1000, reason="Replaced by new connection")
            except Exception:
                pass
            del self.active_connections[session_id]
            
        """Accept and store WebSocket connection."""
        await websocket.accept()
        self.active_connections[session_id] = websocket
        if session_id not in session_monitors:   # ← only create if not exists
          session_monitors[session_id] = RealTimeMonitor()
        print(f"WebSocket connected for session: {session_id}")

    def disconnect(self, session_id: str):
        """Remove WebSocket connection."""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in session_monitors:
            del session_monitors[session_id]
        print(f"WebSocket disconnected for session: {session_id}")

    async def send_message(self, session_id: str, message: dict):
        """Send message to specific session."""
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            await websocket.send_json(message)

    async def broadcast_to_session(self, session_id: str, message: dict):
        """Broadcast message to all connections in a session."""
        await self.send_message(session_id, message)


manager = ConnectionManager()


# ─────────────────────────── Auth helper ─────────────────────────────────────

async def get_current_user_ws(token: str) -> dict:
    """Authenticate user from WebSocket token."""
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    db   = get_database()
    user = await db.users.find_one({"email": payload.get("sub")})

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# ─────────────────────────── Main WebSocket endpoint ─────────────────────────

@router.websocket("/ws/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time interview session.

    Client → Server messages:
      {"type": "auth",        "token": "jwt_token"}
      {"type": "video_frame", "data": "base64_image",  "timestamp": 123}
      {"type": "audio_chunk", "data": "base64_audio",  "transcript": "...", "timestamp": 123}
      {"type": "answer",      "question": "...",        "answer": "...", "duration": 30.5}
      {"type": "end_session"}
      {"type": "ping"}

    Server → Client messages:
      {"type": "auth_success",          "user": "Name"}
      {"type": "session_started",       "total_questions": N}
      {"type": "next_question",         "question": {...}, "question_number": N, "total_questions": N}
      {"type": "analytics",             "data": {"video": {...}, "timestamp": "..."}}
      {"type": "intervention",          "intervention": {...}, "should_interrupt": bool}
      {"type": "answer_feedback",       "feedback": "...", "score": N, "pre_score": N, "action": "..."}
      {"type": "all_questions_complete","message": "..."}
      {"type": "session_complete",      "feedback": {...}, "session_id": "..."}
      {"type": "heartbeat",             "timestamp": "..."}
      {"type": "pong",                  "timestamp": "..."}
    """

    db               = get_database()
    current_user     = None
    is_authenticated = False

    # Verify session exists
    if not ObjectId.is_valid(session_id):
        await websocket.close(code=1003, reason="Invalid session ID")
        return

    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        await websocket.close(code=1003, reason="Session not found")
        return

    await manager.connect(session_id, websocket)

    # Heartbeat task
    async def heartbeat():
        while True:
            try:
                await asyncio.sleep(30)
                await manager.send_message(session_id, {
                    "type":      "heartbeat",
                    "timestamp": datetime.utcnow().isoformat(),
                })
            except:
                break

    asyncio.create_task(heartbeat())

    try:
        # Services
        llm_service        = LLMService()
        feedback_generator = FeedbackGenerator()
        answer_scorer      = AnswerScorer()

        # Session state
        question_index     = 0
        session_start_time = None
        responses          = []          # list of response dicts saved to DB
        follow_ups_given   = 0           # follow-ups given for CURRENT question

        # Get pre-generated questions or generate now
        questions = session.get("generated_questions", [])
        if not questions:
            questions = await llm_service.generate_interview_questions(
                job_description=session["job_description"],
                resume_text=session.get("resume_text"),
                position=session["position"],
            )

        # ── Main message loop ─────────────────────────────────────────────────
        while True:
            data         = await websocket.receive_text()
            print(f"[DEBUG] Raw message received, length: {len(data)}, starts with: {data[:50]}")
            message      = json.loads(data)
            message_type = message.get("type")

            # ── Auth ──────────────────────────────────────────────────────────
            if message_type == "auth":
                token = message.get("token")
                try:
                    current_user = await get_current_user_ws(token)

                    if session["user_id"] != str(current_user["_id"]):
                        await websocket.close(code=1008, reason="Unauthorized")
                        return

                    is_authenticated   = True
                    session_start_time = datetime.utcnow()

                    await db.sessions.update_one(
                        {"_id": ObjectId(session_id)},
                        {"$set": {"status": "in_progress"}},
                    )

                    await manager.send_message(session_id, {
                        "type": "auth_success",
                        "user": current_user["full_name"],
                    })

                    await manager.send_message(session_id, {
                        "type":            "session_started",
                        "message":         "Welcome to your interview session!",
                        "total_questions": len(questions),
                    })

                    if questions:
                        await manager.send_message(session_id, {
                            "type":            "next_question",
                            "question":        questions[question_index],
                            "question_number": question_index + 1,
                            "total_questions": len(questions),
                        })
                    continue

                except Exception as e:
                    print(f"Auth error: {e}")
                    await websocket.close(code=1008, reason="Authentication failed")
                    return

            # Ignore unauthenticated messages except ping
            if not is_authenticated:
                if message_type == "ping":
                    await manager.send_message(session_id, {
                        "type":      "pong",
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                continue

            # ── Video frame ───────────────────────────────────────────────────
            if message_type == "video_frame":
                print(f"[DEBUG] video_frame received")   # ← ADD
                if session_id not in session_monitors:
                    print(f"[DEBUG] no monitor found!")  # ← ADD
                    continue

                monitor    = session_monitors[session_id]
                frame_data = message.get("data")
                print(f"[DEBUG] frame_data length: {len(frame_data) if frame_data else 0}")  # ← ADD
                user_first = current_user.get("full_name", "there").split()[0] \
                             if current_user else "there"

                analysis = await monitor.analyze_frame_realtime(
                    video_frame=frame_data,
                    user_name=user_first,
                )
                # Temporarily add this before BOTH send_message calls:
                print(f"[ANALYTICS SEND] video keys: {list(analysis.get('video_analysis', {}).keys())}, warnings: {analysis.get('warnings', [])}")
                # video_frame handler — send consistent shape
                await manager.send_message(session_id, {
                    "type": "analytics",
                    "data": {
                        "video":     analysis.get("video_analysis", {}),
                        "audio":     {},                              # ← add empty audio
                        "warnings":  analysis.get("warnings", []),   # ← add warnings
                        "timestamp": analysis["timestamp"],
                    },
                })

                if analysis.get("intervention"):
                    await manager.send_message(session_id, {
                        "type":             "intervention",
                        "intervention":     analysis["intervention"],
                        "should_interrupt": analysis.get("should_interrupt", False),
                    })

            # ── Audio chunk ───────────────────────────────────────────────────
            elif message_type == "audio_chunk":
                print(f"[DEBUG] audio_chunk received")  # ← ADD
                if session_id not in session_monitors:
                    continue

                monitor    = session_monitors[session_id]
                audio_data = message.get("data")
                transcript = message.get("transcript")
                user_first = current_user.get("full_name", "there").split()[0] \
                             if current_user else "there"

                analysis = await monitor.analyze_frame_realtime(
                    video_frame=None,
                    audio_chunk=audio_data,
                    transcript=transcript,
                    user_name=user_first,
                )
                
                # Temporarily add this before BOTH send_message calls:
                print(f"[ANALYTICS SEND] video keys: {list(analysis.get('video_analysis', {}).keys())}, warnings: {analysis.get('warnings', [])}")

                if analysis.get("audio_analysis"):
                     await manager.send_message(session_id, {
                        "type": "analytics",
                        "data": {
                            "video":    analysis.get("video_analysis", {}),
                            "audio":    analysis["audio_analysis"],
                            "warnings": analysis.get("warnings", []),
                            "timestamp": analysis["timestamp"],
                        },
                     })

                if analysis.get("intervention"):
                    await manager.send_message(session_id, {
                        "type":             "intervention",
                        "intervention":     analysis["intervention"],
                        "should_interrupt": analysis.get("should_interrupt", False),
                    })

            # ── Answer submitted ──────────────────────────────────────────────
            elif message_type == "answer":
                question_text = message.get("question", "")
                answer_text   = message.get("answer", "").strip()
                duration      = message.get("duration", 0)
                question_type = questions[question_index].get("type", "behavioral") \
                                if question_index < len(questions) else "behavioral"

                monitor = session_monitors.get(session_id)
                
                # ── GUARD: Skip empty answers ──────────────────────────────
                if not answer_text or len(answer_text) < 3:
                    print(f"[Warning] Empty/brief answer detected for Q{question_index + 1}")
                    
                    # Send low feedback to client
                    await manager.send_message(session_id, {
                        "type": "answer_feedback",
                        "feedback": "Your answer was too brief or empty. Please provide more detail.",
                        "score": 0,
                        "pre_score": 0,
                        "action": "next_question",
                    })
                    
                    # Move to next question
                    question_index += 1
                    follow_ups_given = 0
                    
                    # Skip LLM evaluation entirely
                    if question_index < len(questions):
                        await manager.send_message(session_id, {
                            "type": "next_question",
                            "question": questions[question_index],
                            "question_number": question_index + 1,
                            "total_questions": len(questions),
                        })
                    else:
                        # All questions done
                        await manager.send_message(session_id, {
                            "type": "all_questions_complete",
                        })
                    
                    continue 
                
                # Check 2: Off-topic answer (very few question keywords in answer)
                question_words = set(question_text.lower().split())
                answer_words = set(answer_text.lower().split())
                
                # Remove common words (a, the, is, etc)
                common_words = {'a', 'the', 'is', 'are', 'an', 'and', 'or', 'but', 'in', 'at', 'to', 'for', 'of', 'with', 'by'}
                question_keywords = question_words - common_words
                answer_keywords = answer_words - common_words
                
                # Calculate relevance: how many question keywords appear in answer
                keyword_overlap = len(question_keywords & answer_keywords)
                relevance_ratio = keyword_overlap / max(len(question_keywords), 1) if question_keywords else 0
                
                if relevance_ratio < 0.15:  # Less than 15% keyword overlap = off-topic
                    print(f"[Warning] Off-topic answer detected for Q{question_index + 1} (relevance: {relevance_ratio:.2%})")
                    
                    await manager.send_message(session_id, {
                        "type": "answer_feedback",
                        "feedback": "Your answer seems off-topic. Please directly address the question.",
                        "score": 5,  # Very low score
                        "pre_score": 0,
                        "action": "next_question",
                    })
                    
                    question_index += 1
                    follow_ups_given = 0
                    
                    if question_index < len(questions):
                        await manager.send_message(session_id, {
                            "type": "next_question",
                            "question": questions[question_index],
                            "question_number": question_index + 1,
                            "total_questions": len(questions),
                        })
                    else:
                        await manager.send_message(session_id, {
                            "type": "all_questions_complete",
                        })
                    
                    continue

                # ── Step 1: Get per-answer snapshot from analyzers ────────────
                answer_snapshot = monitor.get_answer_snapshot() if monitor else {
                    "video": {}, "audio": {}, "warnings_shown": []
                }
                print(f"[DEBUG] answer_snapshot: {answer_snapshot}")  # ← ADD THIS
                video_snap = answer_snapshot.get("video", {})
                audio_snap = answer_snapshot.get("audio", {})

                # ── Step 2: Pre-score BEFORE sending to LLM ──────────────────
                pre_score = answer_scorer.score_answer(
                    question=question_text,
                    answer=answer_text,
                    filler_count=audio_snap.get("total_filler_words", 0),
                    word_count=audio_snap.get("word_count", 0),
                )

                # ── Step 3: LLM evaluation anchored by pre_score ──────────────
                evaluation = await llm_service.evaluate_answer_quality(
                    question=question_text,
                    answer=answer_text,
                    expected_type=question_type,
                    pre_score=pre_score,
                )

                # ── Step 4: Decide next action (server-side logic) ────────────
                decision = await llm_service.decide_next_action(
                    evaluation=evaluation,
                    pre_score=pre_score,
                    question_number=question_index + 1,
                    total_questions=len(questions),
                    follow_ups_given=follow_ups_given,
                )

                # ── Step 5: Build response record for MongoDB ─────────────────
                response_data = {
                    "question_number":  question_index + 1,
                    "question":         question_text,
                    "question_type":    question_type,
                    "is_follow_up":     follow_ups_given > 0,
                    "answer":           answer_text,
                    "timestamp":        datetime.utcnow(),
                    "duration_seconds": duration,

                    # Pre-score (objective metrics)
                    "pre_score":        pre_score,

                    # LLM evaluation
                    "llm_score":        evaluation.get("overall_score"),
                    "llm_feedback":     evaluation.get("feedback", ""),
                    "llm_decision":     decision["action"],

                    # Analytics snapshots
                    "video_analytics":  video_snap,
                    "audio_analytics":  audio_snap,

                    # Warnings shown on screen during this answer
                    "warnings_shown":   answer_snapshot.get("warnings_shown", []),

                    # Full evaluation for feedback_generator
                    "evaluation":       evaluation,
                }

                responses.append(response_data)

                # Save to MongoDB
                await db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$push": {"responses": response_data}},
                )

                # ── Step 6: Send feedback to client ───────────────────────────
                await manager.send_message(session_id, {
                    "type":      "answer_feedback",
                    "feedback":  evaluation.get("feedback"),
                    "score":     evaluation.get("overall_score"),
                    "pre_score": pre_score.get("composite_pre_score"),
                    "action":    decision["action"],
                })

                # ── Step 7: Reset per-answer state (NOT full session reset) ───
                if monitor:
                    monitor.reset_answer()

                # ── Step 8: Act on decision ───────────────────────────────────
                if decision["action"] == "follow_up":
                    follow_ups_given += 1

                    followup_q = await llm_service.generate_follow_up_question(
                        previous_question=question_text,
                        user_answer=answer_text,
                        context=session.get("job_description", ""),
                    )

                    await manager.send_message(session_id, {
                        "type":            "next_question",
                        "question": {
                            "question":   followup_q,
                            "type":       "follow_up",
                            "difficulty": "medium",
                            "competency": "clarification",
                        },
                        "question_number": question_index + 1,
                        "total_questions": len(questions),
                        "is_follow_up":    True,
                    })

                elif decision["action"] == "end_session":
                    await manager.send_message(session_id, {
                        "type":    "all_questions_complete",
                        "message": "You've answered all questions! "
                                   "Generating your feedback report...",
                    })

                else:
                    # next_question — move to next
                    question_index   += 1
                    follow_ups_given  = 0  # reset follow-up counter for new question

                    if question_index < len(questions):
                        await manager.send_message(session_id, {
                            "type":            "next_question",
                            "question":        questions[question_index],
                            "question_number": question_index + 1,
                            "total_questions": len(questions),
                            "is_follow_up":    False,
                        })
                    else:
                        await manager.send_message(session_id, {
                            "type":    "all_questions_complete",
                            "message": "You've answered all questions! "
                                       "Generating your feedback report...",
                        })

            # ── End session ───────────────────────────────────────────────────
            elif message_type == "end_session":
                session_end_time = datetime.utcnow()
                session_duration = (
                    (session_end_time - session_start_time).total_seconds() / 60
                    if session_start_time else 0
                )

                # Generate comprehensive feedback
                final_feedback = await feedback_generator.generate_comprehensive_feedback(
                    responses=responses,
                    session_data=session,
                    user_name=current_user.get("full_name", "User") if current_user else "User",
                )

                # Update session document
                await db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$set": {
                        "status":           "completed",
                        "duration_minutes": session_duration,
                        "overall_score":    final_feedback["overall_score"],
                        "feedback":         final_feedback,
                        "improvements":     final_feedback.get("improvements", []),
                        "strengths":        final_feedback.get("strengths", []),
                    }},
                )

                # Save AnalyticsModel to separate analytics collection
                monitor = session_monitors.get(session_id)
                if monitor:
                    session_summary = monitor.get_session_summary()
                    analytics_doc = {
                        "session_id":                str(session_id),
                        "user_id":                   session["user_id"],

                        # Video
                        "avg_eye_contact_score":     session_summary["video_summary"].get("eye_contact_score", 0),
                        "avg_engagement_score":      session_summary["video_summary"].get("engagement_score", 0),
                        "dominant_emotion":          session_summary["video_summary"].get("dominant_emotion", "neutral"),
                        "emotion_breakdown":         session_summary["video_summary"].get("emotion_breakdown", {}),
                        "nervousness_rate":          session_summary["video_summary"].get("nervousness_rate", 0),
                        "head_position_breakdown":   session_summary["video_summary"].get("head_position_breakdown", {}),
                        "total_distraction_frames":  session_summary["video_summary"].get("frames_analyzed", 0),
                        "emotion_model_used":        session_summary["video_summary"].get("emotion_model", "HSEmotion EfficientNet-B2"),
                        "issue_frequency":           session_summary.get("issue_history", {}),

                        # Audio
                        "avg_speaking_pace_wpm":     session_summary["audio_summary"].get("average_speaking_pace", 0),
                        "avg_volume_db":             session_summary["audio_summary"].get("average_volume", 0),
                        "avg_pitch_hz":              session_summary["audio_summary"].get("average_pitch", 0),
                        "pitch_variation":           session_summary["audio_summary"].get("pitch_variation", 0),
                        "total_filler_words":        session_summary["audio_summary"].get("total_filler_words", 0),
                        "total_speaking_time_seconds":session_summary["audio_summary"].get("total_speaking_time_seconds", 0),

                        # Content
                        "total_questions_answered":  len(responses),
                        "total_follow_ups_triggered":sum(1 for r in responses if r.get("is_follow_up")),
                        "avg_llm_score":             sum(r.get("llm_score", 0) or 0 for r in responses) / max(len(responses), 1),
                        "avg_pre_score":             sum(r.get("pre_score", {}).get("composite_pre_score", 0) for r in responses) / max(len(responses), 1),

                        # Timeline for graphs (per question)
                        "eye_contact_timeline":  [
                            {"question_number": r["question_number"],
                             "value": r.get("video_analytics", {}).get("avg_eye_contact_score", 0)}
                            for r in responses
                        ],
                        "engagement_timeline": [
                            {"question_number": r["question_number"],
                             "value": r.get("video_analytics", {}).get("avg_engagement_score", 0)}
                            for r in responses
                        ],
                        "speaking_pace_timeline": [
                            {"question_number": r["question_number"],
                             "value": r.get("audio_analytics", {}).get("avg_speaking_pace_wpm", 0)}
                            for r in responses
                        ],
                        "llm_score_timeline": [
                            {"question_number": r["question_number"],
                             "value": r.get("llm_score", 0)}
                            for r in responses
                        ],
                        "emotion_timeline": [
                            {"question_number": r["question_number"],
                             "dominant": r.get("video_analytics", {}).get("dominant_emotion", "neutral")}
                            for r in responses
                        ],

                        "created_at": datetime.utcnow(),
                    }
                    await db.analytics.insert_one(analytics_doc)

                # Update user stats
                if current_user:
                    await db.users.update_one(
                        {"_id": current_user["_id"]},
                        {
                            "$inc": {"total_practice_time_minutes": session_duration},
                            "$set": {"updated_at": datetime.utcnow()},
                        },
                    )

                await manager.send_message(session_id, {
                    "type":       "session_complete",
                    "feedback":   final_feedback,
                    "session_id": session_id,
                })

                await websocket.close(code=1000, reason="Session completed")
                break

            # ── Ping ──────────────────────────────────────────────────────────
            elif message_type == "ping":
                await manager.send_message(session_id, {
                    "type":      "pong",
                    "timestamp": datetime.utcnow().isoformat(),
                })

    except WebSocketDisconnect:
        print(f"Client disconnected from session {session_id}")
        manager.disconnect(session_id)

        session = await db.sessions.find_one({"_id": ObjectId(session_id)})
        if session and session["status"] == "in_progress":
            await db.sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$set": {"status": "aborted"}},
            )

    except Exception as e:
        print(f"Error in WebSocket: {e}")
        import traceback
        traceback.print_exc()
        manager.disconnect(session_id)
        try:
            await websocket.close(code=1011, reason=f"Server error: {str(e)}")
        except:
            pass


# ─────────────────────────── Status endpoint ─────────────────────────────────

@router.get("/ws/status/{session_id}")
async def get_websocket_status(session_id: str):
    """Check if a WebSocket connection is active for a session."""
    return {
        "session_id":               session_id,
        "is_connected":             session_id in manager.active_connections,
        "active_connections_count": len(manager.active_connections),
    }