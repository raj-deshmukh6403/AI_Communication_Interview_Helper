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
from ..utils.auth import decode_access_token

router = APIRouter()

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}
# Store monitors for each session
session_monitors: Dict[str, RealTimeMonitor] = {}


class ConnectionManager:
    """
    Manages WebSocket connections for real-time interview sessions.
    """
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, session_id: str, websocket: WebSocket):
        """Accept and store WebSocket connection."""
        await websocket.accept()
        self.active_connections[session_id] = websocket
        
        # Create a new monitor for this session
        session_monitors[session_id] = RealTimeMonitor()
        
        print(f"WebSocket connected for session: {session_id}")
    
    def disconnect(self, session_id: str):
        """Remove WebSocket connection."""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        
        # Clean up monitor
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


async def get_current_user_ws(token: str) -> dict:
    """
    Authenticate user from WebSocket token.
    """
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    db = get_database()
    user = await db.users.find_one({"email": payload.get("sub")})
    
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


@router.websocket("/ws/interview/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time interview session.
    
    Protocol:
    - Client sends: {"type": "auth", "token": "jwt_token"}
    - Client sends: {"type": "video_frame", "data": "base64_image", "timestamp": 123456}
    - Client sends: {"type": "audio_chunk", "data": "base64_audio", "transcript": "...", "timestamp": 123456}
    - Client sends: {"type": "answer", "question": "...", "answer": "...", "duration": 30.5}
    - Client sends: {"type": "end_session"}
    
    - Server sends: {"type": "intervention", "message": "...", "severity": "high"}
    - Server sends: {"type": "analytics", "data": {...}}
    - Server sends: {"type": "next_question", "question": {...}}
    - Server sends: {"type": "session_complete", "feedback": {...}}
    """
    
    db = get_database()
    current_user = None
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
    
    # Start heartbeat task
    async def heartbeat():
        while True:
            try:
                await asyncio.sleep(30)  # Every 30 seconds
                await manager.send_message(session_id, {
                    "type": "heartbeat",
                    "timestamp": datetime.utcnow().isoformat()
                })
            except:
                break

    asyncio.create_task(heartbeat())
    
    try:
        # Initialize services
        llm_service = LLMService()
        feedback_generator = FeedbackGenerator()
        
        # Track session state
        question_index = 0
        session_start_time = None
        responses = []
        
        # Get pre-generated questions or generate new ones
        questions = session.get("generated_questions", [])
        if not questions:
            # Generate questions on the fly
            questions = await llm_service.generate_interview_questions(
                job_description=session["job_description"],
                resume_text=session.get("resume_text"),
                position=session["position"]
            )
        
        # Main message loop - WAIT FOR AUTHENTICATION FIRST
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            message_type = message.get("type")
            
            # Authentication - MUST HAPPEN FIRST
            if message_type == "auth":
                token = message.get("token")
                try:
                    current_user = await get_current_user_ws(token)
                    
                    # Verify user owns this session
                    if session["user_id"] != str(current_user["_id"]):
                        await websocket.close(code=1008, reason="Unauthorized")
                        return
                    
                    # Mark as authenticated
                    is_authenticated = True
                    session_start_time = datetime.utcnow()
                    
                    # Update session status to in_progress
                    await db.sessions.update_one(
                        {"_id": ObjectId(session_id)},
                        {"$set": {"status": "in_progress"}}
                    )
                    
                    # Send authentication success
                    await manager.send_message(session_id, {
                        "type": "auth_success",
                        "user": current_user["full_name"]
                    })
                    
                    # NOW send session started message
                    await manager.send_message(session_id, {
                        "type": "session_started",
                        "message": "Welcome to your interview session!",
                        "total_questions": len(questions)
                    })
                    
                    # Send first question after authentication
                    if questions:
                        await manager.send_message(session_id, {
                            "type": "next_question",
                            "question": questions[question_index],
                            "question_number": question_index + 1,
                            "total_questions": len(questions)
                        })
                    
                    # Continue to process other messages
                    continue
                    
                except Exception as e:
                    print(f"Authentication error: {e}")
                    await websocket.close(code=1008, reason="Authentication failed")
                    return
            
            # If not authenticated, ignore all other messages except ping
            if not is_authenticated:
                if message_type == "ping":
                    await manager.send_message(session_id, {
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                continue
            
            # Real-time video analysis
            if message_type == "video_frame":
                if session_id not in session_monitors:
                    continue
                
                monitor = session_monitors[session_id]
                frame_data = message.get("data")
                
                # Analyze frame
                analysis = await monitor.analyze_frame_realtime(
                    video_frame=frame_data,
                    user_name=current_user.get("full_name", "there").split()[0] if current_user else "there"
                )
                
                # Send analytics back to client
                await manager.send_message(session_id, {
                    "type": "analytics",
                    "data": {
                        "video": analysis["video_analysis"],
                        "timestamp": analysis["timestamp"]
                    }
                })
                
                # Send intervention if needed
                if analysis.get("intervention"):
                    await manager.send_message(session_id, {
                        "type": "intervention",
                        "intervention": analysis["intervention"],
                        "should_interrupt": analysis.get("should_interrupt", False)
                    })
            
            # Real-time audio analysis
            elif message_type == "audio_chunk":
                if session_id not in session_monitors:
                    continue
                
                monitor = session_monitors[session_id]
                audio_data = message.get("data")
                transcript = message.get("transcript")
                
                # Analyze audio
                analysis = await monitor.analyze_frame_realtime(
                    video_frame=None,
                    audio_chunk=audio_data,
                    transcript=transcript,
                    user_name=current_user.get("full_name", "there").split()[0] if current_user else "there"
                )
                
                # Send analytics
                await manager.send_message(session_id, {
                    "type": "analytics",
                    "data": {
                        "audio": analysis["audio_analysis"],
                        "timestamp": analysis["timestamp"]
                    }
                })
                
                # Send intervention if needed
                if analysis.get("intervention"):
                    await manager.send_message(session_id, {
                        "type": "intervention",
                        "intervention": analysis["intervention"],
                        "should_interrupt": analysis.get("should_interrupt", False)
                    })
            
            # Answer submitted
            elif message_type == "answer":
                question_text = message.get("question")
                answer_text = message.get("answer")
                duration = message.get("duration", 0)
                
                # Get analytics summary for this response
                monitor = session_monitors.get(session_id)
                analytics_summary = monitor.get_session_summary() if monitor else {}
                
                # Evaluate answer quality with LLM
                evaluation = await llm_service.evaluate_answer_quality(
                    question=question_text,
                    answer=answer_text,
                    expected_type=questions[question_index].get("type", "behavioral")
                )
                
                # Store response
                response_data = {
                    "question": question_text,
                    "answer": answer_text,
                    "timestamp": datetime.utcnow(),
                    "duration_seconds": duration,
                    "video_analytics": analytics_summary.get("video_summary", {}),
                    "audio_analytics": analytics_summary.get("audio_summary", {}),
                    "real_time_feedback": [],
                    "evaluation": evaluation
                }
                
                responses.append(response_data)
                
                # Save to database
                await db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$push": {"responses": response_data}}
                )
                
                # Send immediate feedback on answer
                await manager.send_message(session_id, {
                    "type": "answer_feedback",
                    "feedback": evaluation.get("feedback"),
                    "score": evaluation.get("overall_score")
                })
                
                # Reset monitor for next question
                if monitor:
                    monitor.reset()
                
                # Move to next question
                question_index += 1
                
                if question_index < len(questions):
                    # Check if we should generate a follow-up question
                    if message.get("request_followup", False):
                        followup = await llm_service.generate_follow_up_question(
                            previous_question=question_text,
                            user_answer=answer_text,
                            context=session["job_description"]
                        )
                        
                        await manager.send_message(session_id, {
                            "type": "next_question",
                            "question": {
                                "question": followup,
                                "type": "follow_up",
                                "difficulty": "medium"
                            },
                            "question_number": question_index + 1,
                            "total_questions": len(questions)
                        })
                    else:
                        # Send next pre-generated question
                        await manager.send_message(session_id, {
                            "type": "next_question",
                            "question": questions[question_index],
                            "question_number": question_index + 1,
                            "total_questions": len(questions)
                        })
                else:
                    # All questions completed
                    await manager.send_message(session_id, {
                        "type": "all_questions_complete",
                        "message": "You've answered all questions! Generating your feedback report..."
                    })
            
            # End session and generate final feedback
            elif message_type == "end_session":
                session_end_time = datetime.utcnow()
                session_duration = (session_end_time - session_start_time).total_seconds() / 60 if session_start_time else 0
                
                # Generate comprehensive feedback
                final_feedback = await feedback_generator.generate_comprehensive_feedback(
                    responses=responses,
                    session_data=session,
                    user_name=current_user.get("full_name", "User") if current_user else "User"
                )
                
                # Update session in database
                await db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {
                        "$set": {
                            "status": "completed",
                            "duration_minutes": session_duration,
                            "overall_score": final_feedback["overall_score"],
                            "feedback": final_feedback,
                            "improvements": final_feedback.get("improvements", []),
                            "strengths": final_feedback.get("strengths", [])
                        }
                    }
                )
                
                # Update user statistics
                if current_user:
                    await db.users.update_one(
                        {"_id": current_user["_id"]},
                        {
                            "$inc": {"total_practice_time_minutes": session_duration},
                            "$set": {"updated_at": datetime.utcnow()}
                        }
                    )
                
                # Send final feedback to client
                await manager.send_message(session_id, {
                    "type": "session_complete",
                    "feedback": final_feedback,
                    "session_id": session_id
                })
                
                # Close connection gracefully
                await websocket.close(code=1000, reason="Session completed")
                break
            
            # Ping/pong for connection keepalive
            elif message_type == "ping":
                await manager.send_message(session_id, {
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                })

    except WebSocketDisconnect:
        print(f"Client disconnected from session {session_id}")
        manager.disconnect(session_id)
        
        # Mark session as aborted if not completed
        session = await db.sessions.find_one({"_id": ObjectId(session_id)})
        if session and session["status"] == "in_progress":
            await db.sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$set": {"status": "aborted"}}
            )
    
    except Exception as e:
        print(f"Error in WebSocket connection: {e}")
        import traceback
        traceback.print_exc()
        manager.disconnect(session_id)
        
        try:
            await websocket.close(code=1011, reason=f"Server error: {str(e)}")
        except:
            pass


@router.get("/ws/status/{session_id}")
async def get_websocket_status(session_id: str):
    """
    Check if a WebSocket connection is active for a session.
    """
    is_active = session_id in manager.active_connections
    
    return {
        "session_id": session_id,
        "is_connected": is_active,
        "active_connections_count": len(manager.active_connections)
    }