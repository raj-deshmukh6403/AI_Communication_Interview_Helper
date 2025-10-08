from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from .user import PyObjectId

class AnalyticsModel(BaseModel):
    """
    Database model for storing detailed analytics for each session.
    Separate from SessionModel to keep session data lean.
    """
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    session_id: str  # Reference to SessionModel
    user_id: str     # Reference to UserModel
    
    # Aggregated video analytics
    avg_eye_contact_score: float = 0.0
    avg_engagement_score: float = 0.0
    total_looking_away_seconds: float = 0.0
    head_position_distribution: Dict[str, int] = {}  # neutral: 80, looking_down: 10, etc.
    
    # Aggregated audio analytics
    avg_speaking_pace: float = 0.0
    avg_volume_level: float = 0.0
    avg_pitch_hz: float = 0.0
    pitch_variation: float = 0.0
    total_filler_words: int = 0
    filler_words_breakdown: List[Dict[str, Any]] = []  # [{"word": "um", "count": 5}, ...]
    
    # Behavioral patterns
    nervousness_indicators: List[str] = []  # ["speaking_too_fast", "excessive_movement", ...]
    confidence_indicators: List[str] = []   # ["good_eye_contact", "steady_pace", ...]
    
    # Time-series data (for graphs)
    eye_contact_timeline: List[Dict[str, Any]] = []  # [{timestamp, score}, ...]
    speaking_pace_timeline: List[Dict[str, Any]] = []
    engagement_timeline: List[Dict[str, Any]] = []
    
    # Issue tracking
    total_issues_detected: int = 0
    issues_by_type: Dict[str, int] = {}  # {"looking_down": 15, "speaking_too_fast": 8, ...}
    interventions_triggered: List[Dict[str, Any]] = []  # [{type, timestamp, message}, ...]
    
    # Content quality (from LLM evaluations)
    avg_answer_relevance: float = 0.0
    avg_answer_clarity: float = 0.0
    avg_answer_completeness: float = 0.0
    star_method_usage_rate: float = 0.0  # Percentage of behavioral questions using STAR
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}