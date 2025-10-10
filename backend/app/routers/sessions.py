from fastapi import APIRouter, Depends, HTTPException, UploadFile, File,Form, status
from typing import List, Optional
from ..database import get_database
from ..models.session import SessionModel, InterviewResponse
from ..schemas.session import (
    SessionCreate, 
    SessionResponse, 
    SessionDetailResponse,
    SessionCompare
)
from ..routers.auth import get_current_user
from ..services.llm_service import LLMService
import PyPDF2
import json
import docx
import io
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/sessions", tags=["Interview Sessions"])

@router.post("/create", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session: str = Form(...),  # CHANGED
    resume: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new interview session.
    
    - Accepts job description and position as JSON string in 'session' field
    - Optionally accepts resume file (PDF or DOCX)
    - Extracts text from resume for AI context
    - Creates session in database
    """
    db = get_database()
    
    # NEW: Parse the JSON string
    try:
        session_data = json.loads(session)
        session_create = SessionCreate(**session_data)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in session field"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid session data: {str(e)}"
        )
    
    # Process resume if uploaded
    resume_text = session_create.resume_text or ""  # CHANGED
    
    if resume:
        file_content = await resume.read()
        
        if len(file_content) > 5 * 1024 * 1024:  # 5MB
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB."
        )
        
        if resume.filename.endswith('.pdf'):
            try:
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                resume_text = ""
                for page in pdf_reader.pages:
                    resume_text += page.extract_text() + "\n"
                    
                # 👇 ADD THIS DEBUG LOG 👇
                print(f"✅ Extracted {len(resume_text)} characters from PDF")
                print(f"📄 First 200 chars: {resume_text[:200]}")    
            except Exception as e:
                print(f"❌ PDF parsing error: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error reading PDF: {str(e)}"
                )
        
        elif resume.filename.endswith('.docx'):
            try:
                doc = docx.Document(io.BytesIO(file_content))
                resume_text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error reading DOCX: {str(e)}"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload PDF or DOCX."
            )
    
    # Create session model
    session_model = SessionModel(
        user_id=str(current_user["_id"]),
        job_description=session_create.job_description,  # CHANGED
        company_name=session_create.company_name or "",  # CHANGED
        position=session_create.position,  # CHANGED
        status="pending"
    )
    
    # Insert into database
    result = await db.sessions.insert_one(session_model.model_dump(by_alias=True))
    session_id = str(result.inserted_id)
    
    # Update user's session count
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$inc": {"sessions_count": 1},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Store/update resume in user profile if provided
    if resume_text:
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {
                "$set": {
                    "resume_text": resume_text,
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    # Generate initial interview questions using LLM
    llm_service = LLMService()
    try:
        questions = await llm_service.generate_interview_questions(
            job_description=session_create.job_description,  # CHANGED
            resume_text=resume_text or current_user.get("resume_text"),
            position=session_create.position  # CHANGED
        )
        
        # Store generated questions in session
        await db.sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"generated_questions": questions}}
        )
    except Exception as e:
        print(f"Warning: Could not generate questions: {e}")
    
    return SessionResponse(
        id=session_id,
        user_id=str(current_user["_id"]),
        job_description=session_create.job_description,  # CHANGED
        company_name=session_create.company_name or "",  # CHANGED
        position=session_create.position,  # CHANGED
        session_date=session_model.session_date,
        status="pending",
        overall_score=None,
        duration_minutes=None
    )

@router.get("/list", response_model=List[SessionResponse])
async def list_sessions(
    limit: int = 20,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of all user's interview sessions.
    
    - Returns most recent sessions first
    - Supports pagination with limit and skip
    """
    db = get_database()
    
    sessions = await db.sessions.find(
        {"user_id": str(current_user["_id"])}
    ).sort("session_date", -1).skip(skip).limit(limit).to_list(limit)
    
    return [
        SessionResponse(
            id=str(session["_id"]),
            user_id=session["user_id"],
            job_description=session["job_description"],
            company_name=session.get("company_name"),
            position=session["position"],
            session_date=session["session_date"],
            status=session["status"],
            overall_score=session.get("overall_score"),
            duration_minutes=session.get("duration_minutes")
        )
        for session in sessions
    ]

@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed information about a specific session.
    
    - Returns all questions, answers, and analytics
    - Returns final feedback and scores
    """
    db = get_database()
    
    # Validate ObjectId
    if not ObjectId.is_valid(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format"
        )
    
    # Find session
    session = await db.sessions.find_one({
        "_id": ObjectId(session_id),
        "user_id": str(current_user["_id"])
    })
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Convert responses to proper format
    responses = []
    for resp in session.get("responses", []):
        responses.append({
            "question": resp["question"],
            "answer": resp["answer"],
            "timestamp": resp["timestamp"],
            "duration_seconds": resp["duration_seconds"],
            "video_analytics": resp.get("video_analytics", {}),
            "audio_analytics": resp.get("audio_analytics", {}),
            "real_time_feedback": resp.get("real_time_feedback", [])
        })
    
    return SessionDetailResponse(
        id=str(session["_id"]),
        user_id=session["user_id"],
        job_description=session["job_description"],
        company_name=session.get("company_name"),
        position=session["position"],
        session_date=session["session_date"],
        status=session["status"],
        overall_score=session.get("overall_score"),
        duration_minutes=session.get("duration_minutes"),
        responses=responses,
        feedback=session.get("feedback"),
        improvements=session.get("improvements"),
        strengths=session.get("strengths")
    )

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a session.
    """
    db = get_database()
    
    if not ObjectId.is_valid(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format"
        )
    
    result = await db.sessions.delete_one({
        "_id": ObjectId(session_id),
        "user_id": str(current_user["_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Decrement user's session count
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"sessions_count": -1}}
    )
    
    return None

@router.post("/compare", response_model=dict)
async def compare_sessions(
    comparison: SessionCompare,
    current_user: dict = Depends(get_current_user)
):
    """
    Compare two interview sessions to show improvement or regression.
    
    - Compares key metrics between sessions
    - Shows percentage changes
    - Identifies areas of improvement and regression
    """
    db = get_database()
    
    # Validate IDs
    if not ObjectId.is_valid(comparison.session1_id) or not ObjectId.is_valid(comparison.session2_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format"
        )
    
    # Fetch both sessions
    session1 = await db.sessions.find_one({
        "_id": ObjectId(comparison.session1_id),
        "user_id": str(current_user["_id"])
    })
    
    session2 = await db.sessions.find_one({
        "_id": ObjectId(comparison.session2_id),
        "user_id": str(current_user["_id"])
    })
    
    if not session1 or not session2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both sessions not found"
        )
    
    # Get analytics for both sessions
    analytics1 = await db.analytics.find_one({"session_id": comparison.session1_id})
    analytics2 = await db.analytics.find_one({"session_id": comparison.session2_id})
    
    # Build comparison result
    comparison_result = {
        "session1": {
            "id": comparison.session1_id,
            "date": session1["session_date"],
            "position": session1["position"],
            "overall_score": session1.get("overall_score", 0),
            "duration_minutes": session1.get("duration_minutes", 0)
        },
        "session2": {
            "id": comparison.session2_id,
            "date": session2["session_date"],
            "position": session2["position"],
            "overall_score": session2.get("overall_score", 0),
            "duration_minutes": session2.get("duration_minutes", 0)
        },
        "improvements": [],
        "regressions": [],
        "metrics_comparison": {}
    }
    
    # Compare metrics if analytics available
    if analytics1 and analytics2:
        metrics_to_compare = [
            ("eye_contact_score", "Eye Contact"),
            ("speaking_pace", "Speaking Pace"),
            ("confidence_level", "Confidence Level"),
            ("answer_relevance", "Answer Relevance"),
            ("clarity_score", "Clarity"),
            ("volume_consistency", "Volume Consistency")
        ]
        
        for metric_key, metric_name in metrics_to_compare:
            val1 = analytics1.get(metric_key, 0)
            val2 = analytics2.get(metric_key, 0)
            diff = val2 - val1
            percent_change = (diff / val1 * 100) if val1 > 0 else 0
            
            comparison_result["metrics_comparison"][metric_name] = {
                "session1_value": round(val1, 2),
                "session2_value": round(val2, 2),
                "change": round(diff, 2),
                "percent_change": round(percent_change, 2)
            }
            
            # Categorize as improvement or regression
            if abs(diff) > 5:  # Only significant changes
                entry = {
                    "metric": metric_name,
                    "change": round(diff, 2),
                    "percentage": round(percent_change, 2)
                }
                
                if diff > 0:
                    comparison_result["improvements"].append(entry)
                else:
                    comparison_result["regressions"].append(entry)
    
    # Overall score comparison
    score_diff = comparison_result["session2"]["overall_score"] - comparison_result["session1"]["overall_score"]
    comparison_result["overall_improvement"] = {
        "score_change": round(score_diff, 2),
        "improved": score_diff > 0
    }
    
    return comparison_result

@router.get("/statistics/progress")
async def get_progress_statistics(
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's overall progress statistics across all sessions.
    
    - Average scores over time
    - Improvement trends
    - Total practice time
    """
    db = get_database()
    
    # Get all completed sessions
    sessions = await db.sessions.find({
        "user_id": str(current_user["_id"]),
        "status": "completed"
    }).sort("session_date", 1).to_list(100)
    
    if not sessions:
        return {
            "total_sessions": 0,
            "total_practice_time_minutes": 0,
            "average_score": 0,
            "score_trend": [],
            "message": "No completed sessions yet"
        }
    
    # Calculate statistics
    total_time = sum(s.get("duration_minutes", 0) for s in sessions)
    scores = [s.get("overall_score", 0) for s in sessions if s.get("overall_score")]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    # Build score trend for graph
    score_trend = []
    for i, session in enumerate(sessions, 1):
        score_trend.append({
            "session_number": i,
            "date": session["session_date"],
            "score": session.get("overall_score", 0),
            "position": session["position"]
        })
    
    # Calculate improvement rate
    if len(scores) >= 2:
        first_half_avg = sum(scores[:len(scores)//2]) / (len(scores)//2)
        second_half_avg = sum(scores[len(scores)//2:]) / (len(scores) - len(scores)//2)
        improvement_rate = ((second_half_avg - first_half_avg) / first_half_avg * 100) if first_half_avg > 0 else 0
    else:
        improvement_rate = 0
    
    return {
        "total_sessions": len(sessions),
        "total_practice_time_minutes": round(total_time, 1),
        "average_score": round(avg_score, 2),
        "highest_score": max(scores) if scores else 0,
        "lowest_score": min(scores) if scores else 0,
        "improvement_rate": round(improvement_rate, 2),
        "score_trend": score_trend
    }