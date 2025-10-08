from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from .user import PyObjectId

class InterviewResponse(BaseModel):
    """
    Model for a single question-answer pair in an interview session.
    """
    question: str
    answer: str
    timestamp: datetime
    duration_seconds: float
    
    # Real-time analytics for this specific response
    video_analytics: Dict[str, Any] = {}
    audio_analytics: Dict[str, Any] = {}
    real_time_feedback: List[str] = []

class SessionModel(BaseModel):
    """
    Database model for storing complete interview session data.
    """
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    user_id: str  # Reference to UserModel
    
    # Job context
    job_description: str
    company_name: Optional[str] = None
    position: str
    
    # Session metadata
    session_date: datetime = Field(default_factory=datetime.utcnow)
    duration_minutes: Optional[float] = None
    status: str = "pending"  # pending, in_progress, completed, aborted
    
    # Interview data
    responses: List[InterviewResponse] = []
    
    # Final results
    overall_score: Optional[float] = None
    feedback: Optional[Dict[str, Any]] = None
    improvements: Optional[List[str]] = None
    strengths: Optional[List[str]] = None
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}