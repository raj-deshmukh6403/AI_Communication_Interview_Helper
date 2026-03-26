from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
from ..database import get_database
from ..models.session import SessionModel, InterviewResponse
from ..schemas.session import (
    SessionCreate,
    SessionResponse,
    SessionDetailResponse,
    SessionCompare,
)
from ..routers.auth import get_current_user
from ..services.llm_service import LLMService
from ..utils.session_naming import generate_session_name, get_next_session_number
import PyPDF2
import json
import docx
import io
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/sessions", tags=["Interview Sessions"])


@router.post("/create", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session: str = Form(...),
    resume:  Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new interview session.
    - Accepts job description and position as JSON string in 'session' field
    - Optionally accepts resume file (PDF or DOCX)
    - Generates a unique human-readable session name
    - Stores resume_text on the session document
    """
    db = get_database()

    try:
        session_data   = json.loads(session)
        session_create = SessionCreate(**session_data)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in session field",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid session data: {str(e)}",
        )

    # Process resume
    resume_text = session_create.resume_text or ""

    if resume:
        file_content = await resume.read()

        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size is 5MB.",
            )

        if resume.filename.endswith(".pdf"):
            try:
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                resume_text = ""
                for page in pdf_reader.pages:
                    resume_text += page.extract_text() + "\n"
                print(f"✅ Extracted {len(resume_text)} characters from PDF")
                print(f"📄 First 200 chars: {resume_text[:200]}")
            except Exception as e:
                print(f"❌ PDF parsing error: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error reading PDF: {str(e)}",
                )

        elif resume.filename.endswith(".docx"):
            try:
                doc = docx.Document(io.BytesIO(file_content))
                resume_text = "\n".join([p.text for p in doc.paragraphs])
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error reading DOCX: {str(e)}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload PDF or DOCX.",
            )

    # ── Generate unique session name ──────────────────────────────────────────
    session_number = await get_next_session_number(db, str(current_user["_id"]))
    session_name   = generate_session_name(
        position=session_create.position,
        company_name=session_create.company_name,
        session_number=session_number,
    )

    # ── Create session model ──────────────────────────────────────────────────
    session_model = SessionModel(
        user_id=str(current_user["_id"]),
        session_name=session_name,
        job_description=session_create.job_description,
        company_name=session_create.company_name or "",
        position=session_create.position,
        resume_text=resume_text or None,    # ← saved on session document
        status="pending",
    )

    result     = await db.sessions.insert_one(session_model.model_dump(by_alias=True))
    session_id = str(result.inserted_id)

    # Update user session count
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$inc": {"sessions_count": 1},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )

    # Save resume to user profile too
    if resume_text:
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"resume_text": resume_text, "updated_at": datetime.utcnow()}},
        )

    # Generate questions
    llm_service = LLMService()
    try:
        questions = await llm_service.generate_interview_questions(
            job_description=session_create.job_description,
            resume_text=resume_text or current_user.get("resume_text"),
            position=session_create.position,
        )
        await db.sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"generated_questions": questions}},
        )
    except Exception as e:
        print(f"Warning: Could not generate questions: {e}")

    return SessionResponse(
        id=session_id,
        user_id=str(current_user["_id"]),
        job_description=session_create.job_description,
        company_name=session_create.company_name or "",
        position=session_create.position,
        session_name=session_name,              # ← included in response
        session_date=session_model.session_date,
        status="pending",
        overall_score=None,
        duration_minutes=None,
    )


@router.get("/list", response_model=List[SessionResponse])
async def list_sessions(
    limit: int = 20,
    skip:  int = 0,
    current_user: dict = Depends(get_current_user),
):
    """Get list of all user's interview sessions, most recent first."""
    db = get_database()

    sessions = await db.sessions.find(
        {"user_id": str(current_user["_id"])}
    ).sort("session_date", -1).skip(skip).limit(limit).to_list(limit)

    return [
        SessionResponse(
            id=str(s["_id"]),
            user_id=s["user_id"],
            job_description=s["job_description"],
            company_name=s.get("company_name"),
            position=s["position"],
            session_name=s.get("session_name", ""),   # ← included
            session_date=s["session_date"],
            status=s["status"],
            overall_score=s.get("overall_score"),
            duration_minutes=s.get("duration_minutes"),
        )
        for s in sessions
    ]


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(
    session_id:   str,
    current_user: dict = Depends(get_current_user),
):
    """Get detailed information about a specific session."""
    db = get_database()

    if not ObjectId.is_valid(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format",
        )

    session = await db.sessions.find_one({
        "_id":     ObjectId(session_id),
        "user_id": str(current_user["_id"]),
    })

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    responses = []
    for resp in session.get("responses", []):
        responses.append({
            "question_number": resp.get("question_number"),
            "question":        resp["question"],
            "question_type":   resp.get("question_type", "behavioral"),
            "is_follow_up":    resp.get("is_follow_up", False),
            "answer":          resp["answer"],
            "timestamp":       resp["timestamp"],
            "duration_seconds":resp["duration_seconds"],
            "pre_score":       resp.get("pre_score", {}),
            "llm_score":       resp.get("llm_score"),
            "llm_feedback":    resp.get("llm_feedback", ""),
            "video_analytics": resp.get("video_analytics", {}),
            "audio_analytics": resp.get("audio_analytics", {}),
            "warnings_shown":  resp.get("warnings_shown", []),
            "evaluation":      resp.get("evaluation", {}),
        })

    return SessionDetailResponse(
        id=str(session["_id"]),
        user_id=session["user_id"],
        job_description=session["job_description"],
        company_name=session.get("company_name"),
        position=session["position"],
        session_name=session.get("session_name", ""),   # ← included
        session_date=session["session_date"],
        status=session["status"],
        overall_score=session.get("overall_score"),
        duration_minutes=session.get("duration_minutes"),
        responses=responses,
        feedback=session.get("feedback"),
        improvements=session.get("improvements"),
        strengths=session.get("strengths"),
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id:   str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a session."""
    db = get_database()

    if not ObjectId.is_valid(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format",
        )

    result = await db.sessions.delete_one({
        "_id":     ObjectId(session_id),
        "user_id": str(current_user["_id"]),
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"sessions_count": -1}},
    )
    return None


@router.post("/compare", response_model=dict)
async def compare_sessions(
    comparison:   SessionCompare,
    current_user: dict = Depends(get_current_user),
):
    """Compare two interview sessions to show improvement or regression."""
    db = get_database()

    if not ObjectId.is_valid(comparison.session1_id) or \
       not ObjectId.is_valid(comparison.session2_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format",
        )

    session1 = await db.sessions.find_one({
        "_id": ObjectId(comparison.session1_id),
        "user_id": str(current_user["_id"]),
    })
    session2 = await db.sessions.find_one({
        "_id": ObjectId(comparison.session2_id),
        "user_id": str(current_user["_id"]),
    })

    if not session1 or not session2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both sessions not found",
        )

    analytics1 = await db.analytics.find_one({"session_id": comparison.session1_id})
    analytics2 = await db.analytics.find_one({"session_id": comparison.session2_id})

    comparison_result = {
        "session1": {
            "id":               comparison.session1_id,
            "session_name":     session1.get("session_name", ""),
            "date":             session1["session_date"],
            "position":         session1["position"],
            "overall_score":    session1.get("overall_score", 0),
            "duration_minutes": session1.get("duration_minutes", 0),
        },
        "session2": {
            "id":               comparison.session2_id,
            "session_name":     session2.get("session_name", ""),
            "date":             session2["session_date"],
            "position":         session2["position"],
            "overall_score":    session2.get("overall_score", 0),
            "duration_minutes": session2.get("duration_minutes", 0),
        },
        "improvements":       [],
        "regressions":        [],
        "metrics_comparison": {},
    }

    if analytics1 and analytics2:
        metrics_to_compare = [
            ("avg_eye_contact_score",  "Eye Contact"),
            ("avg_speaking_pace_wpm",  "Speaking Pace"),
            ("avg_engagement_score",   "Engagement"),
            ("avg_llm_score",          "Answer Quality"),
            ("nervousness_rate",       "Nervousness Rate"),
            ("total_filler_words",     "Filler Words"),
        ]

        for key, name in metrics_to_compare:
            v1   = analytics1.get(key, 0)
            v2   = analytics2.get(key, 0)
            diff = v2 - v1
            pct  = (diff / v1 * 100) if v1 > 0 else 0

            comparison_result["metrics_comparison"][name] = {
                "session1_value":  round(v1,   2),
                "session2_value":  round(v2,   2),
                "change":          round(diff, 2),
                "percent_change":  round(pct,  2),
            }

            if abs(diff) > 5:
                entry = {"metric": name, "change": round(diff, 2), "percentage": round(pct, 2)}
                if diff > 0:
                    comparison_result["improvements"].append(entry)
                else:
                    comparison_result["regressions"].append(entry)

    score_diff = (
        comparison_result["session2"]["overall_score"] -
        comparison_result["session1"]["overall_score"]
    )
    comparison_result["overall_improvement"] = {
        "score_change": round(score_diff, 2),
        "improved":     score_diff > 0,
    }

    return comparison_result


@router.get("/statistics/progress")
async def get_progress_statistics(
    current_user: dict = Depends(get_current_user),
):
    """Get user's overall progress statistics across all sessions."""
    db = get_database()

    sessions = await db.sessions.find({
        "user_id": str(current_user["_id"]),
        "status":  "completed",
    }).sort("session_date", 1).to_list(100)

    if not sessions:
        return {
            "total_sessions":              0,
            "total_practice_time_minutes": 0,
            "average_score":               0,
            "score_trend":                 [],
            "message":                     "No completed sessions yet",
        }

    total_time = sum(s.get("duration_minutes", 0) for s in sessions)
    scores     = [s.get("overall_score", 0) for s in sessions if s.get("overall_score")]
    avg_score  = sum(scores) / len(scores) if scores else 0

    score_trend = [
        {
            "session_number": i,
            "date":           s["session_date"],
            "session_name":   s.get("session_name", ""),
            "score":          s.get("overall_score", 0),
            "position":       s["position"],
        }
        for i, s in enumerate(sessions, 1)
    ]

    if len(scores) >= 2:
        half       = len(scores) // 2
        first_avg  = sum(scores[:half]) / half
        second_avg = sum(scores[half:]) / (len(scores) - half)
        improvement_rate = (
            (second_avg - first_avg) / first_avg * 100
        ) if first_avg > 0 else 0
    else:
        improvement_rate = 0

    return {
        "total_sessions":              len(sessions),
        "total_practice_time_minutes": round(total_time, 1),
        "average_score":               round(avg_score,  2),
        "highest_score":               max(scores) if scores else 0,
        "lowest_score":                min(scores) if scores else 0,
        "improvement_rate":            round(improvement_rate, 2),
        "score_trend":                 score_trend,
    }