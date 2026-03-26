"""
analytics.py — MongoDB schema for session-level analytics
==========================================================
Separate from session.py to keep session document lean.
Stores aggregated + time-series data for graphs and feedback.
One AnalyticsModel document per session.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from .user import PyObjectId


class AnalyticsModel(BaseModel):
    """
    Aggregated analytics for a complete session.
    Created when session ends, referenced by session_id.
    """
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    session_id: str   # Reference to SessionModel._id
    user_id:    str   # Reference to UserModel._id

    # ── Video analytics (session-wide averages) ───────────────────────────────
    avg_eye_contact_score:       float = 0.0
    avg_engagement_score:        float = 0.0
    dominant_emotion:            str   = "neutral"
    emotion_breakdown:           Dict[str, float] = {}  # across whole session
    nervousness_rate:            float = 0.0            # % of frames
    head_position_breakdown:     Dict[str, int]   = {}
    total_distraction_frames:    int   = 0
    emotion_model_used:          str   = "HSEmotion EfficientNet-B2 (AffectNet)"
    # For research paper: cite Savchenko A.V., IEEE Trans. Affective Computing, 2022

    # ── Audio analytics (session-wide averages) ───────────────────────────────
    avg_speaking_pace_wpm:       float = 0.0
    avg_volume_db:               float = 0.0
    avg_pitch_hz:                float = 0.0
    pitch_variation:             float = 0.0
    total_filler_words:          int   = 0
    filler_word_breakdown:       Dict[str, int]   = {}
    total_speaking_time_seconds: float = 0.0
    total_silence_seconds:       float = 0.0

    # ── Content quality (from LLM evaluations) ────────────────────────────────
    avg_llm_score:               float = 0.0
    avg_pre_score:               float = 0.0
    avg_answer_relevance:        float = 0.0
    avg_star_usage:              float = 0.0    # % of answers using STAR
    total_questions_answered:    int   = 0
    total_follow_ups_triggered:  int   = 0

    # ── Behavioral patterns ────────────────────────────────────────────────────
    nervousness_indicators:      List[str] = []
    confidence_indicators:       List[str] = []
    issue_frequency:             Dict[str, int] = {}  # {poor_eye_contact: 12, ...}

    # ── Time-series data (for frontend graphs) ────────────────────────────────
    # Each entry: {"question_number": 1, "value": 75.0}
    eye_contact_timeline:        List[Dict[str, Any]] = []
    engagement_timeline:         List[Dict[str, Any]] = []
    speaking_pace_timeline:      List[Dict[str, Any]] = []
    llm_score_timeline:          List[Dict[str, Any]] = []
    emotion_timeline:            List[Dict[str, Any]] = []
    # Each entry: {"question_number": 1, "dominant": "happy", "breakdown": {...}}

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}