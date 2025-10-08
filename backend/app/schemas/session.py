from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class SessionCreate(BaseModel):
    """
    Schema for creating a new interview session.
    """
    job_description: str = Field(..., min_length=50, description="Detailed job description")
    company_name: Optional[str] = None
    position: str = Field(..., min_length=2, description="Job position/role")
    resume_text: Optional[str] = None  # If user doesn't upload file
    
    class Config:
        json_schema_extra = {
            "example": {
                "job_description": "We are looking for a senior software engineer...",
                "company_name": "Tech Corp",
                "position": "Senior Software Engineer",
                "resume_text": "Experienced developer with 5 years..."
            }
        }

class SessionResponse(BaseModel):
    """
    Schema for session data in API responses.
    """
    id: str
    user_id: str
    job_description: str
    company_name: Optional[str]
    position: str
    session_date: datetime
    status: str
    duration_minutes: Optional[float]
    overall_score: Optional[float]
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "user_id": "507f1f77bcf86cd799439012",
                "job_description": "Looking for software engineer...",
                "position": "Software Engineer",
                "session_date": "2024-01-01T10:00:00",
                "status": "completed",
                "duration_minutes": 25.5,
                "overall_score": 85.5
            }
        }

class SessionDetailResponse(SessionResponse):
    """
    Schema for detailed session data including all responses.
    """
    responses: List[Dict[str, Any]]
    feedback: Optional[Dict[str, Any]]
    improvements: Optional[List[str]]
    strengths: Optional[List[str]]

class SessionCompare(BaseModel):
    """
    Schema for comparing two sessions.
    """
    session1_id: str
    session2_id: str

class SessionUpdate(BaseModel):
    """
    Schema for updating session (e.g., marking as completed).
    """
    status: Optional[str] = None
    duration_minutes: Optional[float] = None
    overall_score: Optional[float] = None