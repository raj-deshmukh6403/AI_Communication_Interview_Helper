"""
session.py — MongoDB schema for interview sessions
===================================================
Each session stores:
  - Unique auto-generated session name (visible to user)
  - Resume + job description inputs
  - Each question asked + answer given + individual scores
  - Per-answer video analytics (emotion, eye contact, engagement)
  - Per-answer audio analytics (pace, tone, filler words, transcript)
  - Final feedback report
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from .user import PyObjectId


# ─────────────────────────── Per-answer video snapshot ───────────────────────
class VideoSnapshot(BaseModel):
    """
    Aggregated video analytics for one answer/question period.
    Collected by VideoAnalyzer and saved when user submits answer.
    """
    frames_analyzed:          int   = 0
    avg_eye_contact_score:    float = 0.0
    avg_engagement_score:     float = 0.0
    dominant_emotion:         str   = "neutral"
    emotion_breakdown:        Dict[str, float] = {}   # {happy: 40, neutral: 35, ...}
    nervousness_rate:         float = 0.0             # % of frames with nervousness
    nervousness_indicators:   List[str] = []
    head_position_breakdown:  Dict[str, int] = {}     # {neutral:80, looking_down:5, ...}
    issue_counts:             Dict[str, int] = {}     # {poor_eye_contact:3, ...}
    eye_closed_count:         int   = 0
    emotion_model:            str   = "HSEmotion EfficientNet-B2 (AffectNet)"


# ─────────────────────────── Per-answer audio snapshot ───────────────────────
class AudioSnapshot(BaseModel):
    """
    Aggregated audio analytics for one answer/question period.
    Collected by AudioAnalyzer from the answer recording.
    """
    transcript:               str   = ""
    word_count:               int   = 0
    speaking_duration_seconds:float = 0.0
    avg_speaking_pace_wpm:    float = 0.0    # words per minute
    avg_volume_db:            float = 0.0
    avg_pitch_hz:             float = 0.0
    pitch_variation:          float = 0.0   # std dev of pitch
    total_filler_words:       int   = 0
    filler_word_breakdown:    Dict[str, int] = {}  # {um: 3, uh: 2, like: 5}
    silence_percentage:       float = 0.0
    issues:                   List[str] = []


# ─────────────────────────── Pre-score (objective metrics) ───────────────────
class PreScore(BaseModel):
    """
    Objective metrics calculated BEFORE sending to LLM.
    These anchor the LLM score so it can't randomly be too generous/strict.
    """
    word_count_score:         float = 0.0   # 0-100, based on answer length
    filler_word_score:        float = 0.0   # 0-100, penalised for fillers
    star_keyword_score:       float = 0.0   # 0-100, STAR structure detected
    specificity_score:        float = 0.0   # 0-100, numbers/dates/names present
    relevance_score:          float = 0.0   # 0-100, keyword overlap with question
    sentence_clarity_score:   float = 0.0   # 0-100, avg sentence length
    composite_pre_score:      float = 0.0   # weighted average of above


# ─────────────────────────── Per Q&A response ────────────────────────────────
class InterviewResponse(BaseModel):
    """
    One complete question-answer exchange, with all analytics.
    """
    question_number:    int
    question:           str
    question_type:      str   = "behavioral"   # behavioral / technical / situational
    is_follow_up:       bool  = False
    follow_up_of:       Optional[int] = None   # question_number this follows up on

    answer:             str   = ""
    timestamp:          datetime = Field(default_factory=datetime.utcnow)
    duration_seconds:   float = 0.0

    # Objective pre-scoring (calculated before LLM)
    pre_score:          Optional[PreScore] = None

    # LLM evaluation
    llm_score:          Optional[float] = None   # 0-100, anchored by pre_score
    llm_feedback:       str = ""                  # short per-answer feedback
    llm_decision:       str = "next_question"     # next_question / follow_up / end

    # Analytics per answer
    video_analytics:    Optional[VideoSnapshot] = None
    audio_analytics:    Optional[AudioSnapshot] = None

    # Live warnings that were shown during this answer
    warnings_shown:     List[str] = []


# ─────────────────────────── Main session model ──────────────────────────────
class SessionModel(BaseModel):
    """
    Complete interview session stored in MongoDB 'sessions' collection.
    One document per session.
    """
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    user_id: str

    # Auto-generated unique session name visible to user
    # Format: "Software Engineer @ Google — Mar 24, 2026 #3"
    session_name: str = ""

    # User inputs
    job_description:    str
    resume_text:        Optional[str] = None
    company_name:       Optional[str] = None
    position:           str

    # Session lifecycle
    session_date:       datetime = Field(default_factory=datetime.utcnow)
    duration_minutes:   Optional[float] = None
    status:             str = "pending"   # pending / in_progress / completed / aborted

    # Questions generated for this session
    generated_questions: List[Dict[str, Any]] = []

    # All Q&A responses with full analytics
    responses:          List[InterviewResponse] = []

    # Final feedback (generated at end of session)
    overall_score:      Optional[float] = None
    feedback:           Optional[Dict[str, Any]] = None
    strengths:          Optional[List[str]] = None
    improvements:       Optional[List[str]] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}