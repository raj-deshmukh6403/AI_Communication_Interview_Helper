from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class RealTimeFeedback(BaseModel):
    """
    Schema for real-time feedback messages sent during interview.
    """
    type: str = Field(..., description="Type of feedback: speaking_pace, eye_contact, nervousness, etc.")
    message: str = Field(..., description="The feedback message to display")
    severity: str = Field(..., description="Severity level: info, warning, critical")
    timestamp: float = Field(..., description="Timestamp when feedback was triggered")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "speaking_pace",
                "message": "John, are you nervous? Try to slow down your speaking pace.",
                "severity": "warning",
                "timestamp": 1234567890.123
            }
        }

class VideoFrame(BaseModel):
    """
    Schema for video frame sent from client via WebSocket.
    """
    frame_data: str = Field(..., description="Base64 encoded image data")
    timestamp: float
    session_id: str

class AudioChunk(BaseModel):
    """
    Schema for audio chunk sent from client via WebSocket.
    """
    audio_data: str = Field(..., description="Base64 encoded audio data")
    timestamp: float
    session_id: str

class AnalyticsSnapshot(BaseModel):
    """
    Schema for a snapshot of analytics at a point in time.
    """
    timestamp: float
    
    # Visual metrics
    eye_contact_score: float = Field(..., ge=0, le=100)
    face_detected: bool
    head_position: str  # neutral, looking_down, looking_up, turned_left, turned_right
    
    # Audio metrics
    speaking_pace: float  # words per minute
    volume_level: float = Field(..., ge=0, le=100)
    pitch_hz: Optional[float] = None
    
    # Detected issues
    issues: List[str] = []

class SessionFeedbackReport(BaseModel):
    """
    Schema for the final comprehensive feedback report after session.
    """
    session_id: str
    overall_score: float = Field(..., ge=0, le=100)
    
    # Component scores
    communication_score: float = Field(..., ge=0, le=100)
    confidence_score: float = Field(..., ge=0, le=100)
    content_quality_score: float = Field(..., ge=0, le=100)
    
    # Detailed metrics
    avg_eye_contact: float
    avg_speaking_pace: float
    filler_words_count: int
    total_speaking_time_seconds: float
    
    # Qualitative feedback
    strengths: List[str]
    improvements: List[str]
    detailed_feedback: str
    
    # Time-series data for graphs
    analytics_timeline: List[AnalyticsSnapshot]