from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from ..database import get_database
from ..routers.auth import get_current_user
from bson import ObjectId
from datetime import datetime, timedelta

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/session/{session_id}")
async def get_session_analytics(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed analytics for a specific session.
    """
    db = get_database()
    
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    # Get session
    session = await db.sessions.find_one({
        "_id": ObjectId(session_id),
        "user_id": str(current_user["_id"])
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get analytics
    analytics = await db.analytics.find_one({"session_id": session_id})
    
    if not analytics:
        # Generate analytics from session data if not exists
        analytics = {
            "session_id": session_id,
            "message": "Analytics not yet generated for this session"
        }
    
    return analytics

@router.get("/user/summary")
async def get_user_analytics_summary(
    current_user: dict = Depends(get_current_user)
):
    """
    Get summary analytics across all user sessions.
    """
    db = get_database()
    
    # Get all user's sessions
    sessions = await db.sessions.find({
        "user_id": str(current_user["_id"]),
        "status": "completed"
    }).to_list(100)
    
    if not sessions:
        return {
            "total_sessions": 0,
            "average_score": 0,
            "improvement_trend": 0,
            "message": "No completed sessions yet"
        }
    
    # Calculate summary
    scores = [s.get("overall_score", 0) for s in sessions if s.get("overall_score")]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    # Calculate improvement
    if len(scores) >= 2:
        recent_avg = sum(scores[-3:]) / min(3, len(scores[-3:]))
        older_avg = sum(scores[:3]) / min(3, len(scores[:3]))
        improvement = recent_avg - older_avg
    else:
        improvement = 0
    
    return {
        "total_sessions": len(sessions),
        "average_score": round(avg_score, 2),
        "highest_score": max(scores) if scores else 0,
        "latest_score": scores[-1] if scores else 0,
        "improvement_trend": round(improvement, 2),
        "total_practice_time": current_user.get("total_practice_time_minutes", 0)
    }

@router.get("/{session_id}")
async def get_session_analytics(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed analytics for a specific session.
    
    Returns:
        - Aggregated metrics
        - Time-series data for graphs
        - Issue breakdown
        - Behavioral patterns
    """
    db = get_database()
    
    # Validate ObjectId
    if not ObjectId.is_valid(session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format"
        )
    
    # Verify session belongs to user
    session = await db.sessions.find_one({
        "_id": ObjectId(session_id),
        "user_id": str(current_user["_id"])
    })
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Get analytics
    analytics = await db.analytics.find_one({"session_id": session_id})
    
    if not analytics:
        return {
            "session_id": session_id,
            "message": "Analytics not yet generated for this session",
            "data": None
        }
    
    # Format response
    return {
        "session_id": session_id,
        "video_analytics": {
            "avg_eye_contact_score": analytics.get("avg_eye_contact_score", 0),
            "avg_engagement_score": analytics.get("avg_engagement_score", 0),
            "total_looking_away_seconds": analytics.get("total_looking_away_seconds", 0),
            "head_position_distribution": analytics.get("head_position_distribution", {}),
            "eye_contact_timeline": analytics.get("eye_contact_timeline", [])
        },
        "audio_analytics": {
            "avg_speaking_pace": analytics.get("avg_speaking_pace", 0),
            "avg_volume_level": analytics.get("avg_volume_level", 0),
            "avg_pitch_hz": analytics.get("avg_pitch_hz", 0),
            "total_filler_words": analytics.get("total_filler_words", 0),
            "filler_words_breakdown": analytics.get("filler_words_breakdown", []),
            "speaking_pace_timeline": analytics.get("speaking_pace_timeline", [])
        },
        "behavioral_patterns": {
            "nervousness_indicators": analytics.get("nervousness_indicators", []),
            "confidence_indicators": analytics.get("confidence_indicators", [])
        },
        "issues": {
            "total_issues_detected": analytics.get("total_issues_detected", 0),
            "issues_by_type": analytics.get("issues_by_type", {}),
            "interventions_triggered": analytics.get("interventions_triggered", [])
        },
        "content_quality": {
            "avg_answer_relevance": analytics.get("avg_answer_relevance", 0),
            "avg_answer_clarity": analytics.get("avg_answer_clarity", 0),
            "avg_answer_completeness": analytics.get("avg_answer_completeness", 0),
            "star_method_usage_rate": analytics.get("star_method_usage_rate", 0)
        }
    }

@router.get("/user/trends")
async def get_user_trends(
    current_user: dict = Depends(get_current_user),
    days: int = 30
):
    """
    Get user's performance trends over time.
    
    Args:
        days: Number of days to analyze (default 30)
    
    Returns:
        Trend data for various metrics across sessions
    """
    db = get_database()
    
    # Get sessions from last N days
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    sessions = await db.sessions.find({
        "user_id": str(current_user["_id"]),
        "status": "completed",
        "session_date": {"$gte": cutoff_date}
    }).sort("session_date", 1).to_list(100)
    
    if not sessions:
        return {
            "period_days": days,
            "total_sessions": 0,
            "message": "No completed sessions in this period"
        }
    
    # Collect analytics for each session
    session_ids = [str(s["_id"]) for s in sessions]
    analytics_list = await db.analytics.find({
        "session_id": {"$in": session_ids}
    }).to_list(100)
    
    # Build analytics map
    analytics_map = {a["session_id"]: a for a in analytics_list}
    
    # Build trends
    trends = {
        "period_days": days,
        "total_sessions": len(sessions),
        "overall_score_trend": [],
        "eye_contact_trend": [],
        "speaking_pace_trend": [],
        "confidence_trend": [],
        "filler_words_trend": []
    }
    
    for session in sessions:
        session_id = str(session["_id"])
        analytics = analytics_map.get(session_id, {})
        
        data_point = {
            "date": session["session_date"].isoformat(),
            "session_id": session_id,
            "position": session.get("position", "Unknown")
        }
        
        # Overall score
        trends["overall_score_trend"].append({
            **data_point,
            "score": session.get("overall_score", 0)
        })
        
        # Eye contact
        trends["eye_contact_trend"].append({
            **data_point,
            "score": analytics.get("avg_eye_contact_score", 0)
        })
        
        # Speaking pace
        trends["speaking_pace_trend"].append({
            **data_point,
            "pace": analytics.get("avg_speaking_pace", 0)
        })
        
        # Confidence (engagement as proxy)
        trends["confidence_trend"].append({
            **data_point,
            "score": analytics.get("avg_engagement_score", 0)
        })
        
        # Filler words
        trends["filler_words_trend"].append({
            **data_point,
            "count": analytics.get("total_filler_words", 0)
        })
    
    return trends

@router.get("/user/weak-areas")
async def identify_weak_areas(
    current_user: dict = Depends(get_current_user),
    limit: int = 5
):
    """
    Identify user's weakest areas based on recent sessions.
    
    Returns:
        List of areas that need most improvement with specific metrics
    """
    db = get_database()
    
    # Get recent completed sessions
    sessions = await db.sessions.find({
        "user_id": str(current_user["_id"]),
        "status": "completed"
    }).sort("session_date", -1).limit(10).to_list(10)
    
    if not sessions:
        return {
            "weak_areas": [],
            "message": "Complete some sessions first to identify areas for improvement"
        }
    
    # Get analytics
    session_ids = [str(s["_id"]) for s in sessions]
    analytics_list = await db.analytics.find({
        "session_id": {"$in": session_ids}
    }).to_list(100)
    
    if not analytics_list:
        return {
            "weak_areas": [],
            "message": "Analytics not available"
        }
    
    # Calculate average scores for each metric
    metrics = {
        "eye_contact": {"scores": [], "name": "Eye Contact", "threshold": 70},
        "speaking_pace": {"scores": [], "name": "Speaking Pace", "threshold": None, "optimal_range": (140, 160)},
        "volume": {"scores": [], "name": "Voice Volume", "threshold": 50},
        "engagement": {"scores": [], "name": "Engagement", "threshold": 70},
        "filler_words": {"scores": [], "name": "Filler Words", "threshold": 5, "lower_is_better": True},
        "answer_relevance": {"scores": [], "name": "Answer Relevance", "threshold": 70}
    }
    
    # Collect scores
    for analytics in analytics_list:
        metrics["eye_contact"]["scores"].append(analytics.get("avg_eye_contact_score", 0))
        metrics["speaking_pace"]["scores"].append(analytics.get("avg_speaking_pace", 0))
        metrics["volume"]["scores"].append(analytics.get("avg_volume_level", 0))
        metrics["engagement"]["scores"].append(analytics.get("avg_engagement_score", 0))
        metrics["filler_words"]["scores"].append(analytics.get("total_filler_words", 0))
        metrics["answer_relevance"]["scores"].append(analytics.get("avg_answer_relevance", 0))
    
    # Identify weak areas
    weak_areas = []
    
    for key, data in metrics.items():
        if not data["scores"]:
            continue
        
        avg_score = sum(data["scores"]) / len(data["scores"])
        
        # Check if it's a weak area
        is_weak = False
        suggestion = ""
        
        if key == "speaking_pace":
            # Special case: optimal range
            if avg_score < 130 or avg_score > 170:
                is_weak = True
                if avg_score < 130:
                    suggestion = "Your speaking pace is too slow. Practice speaking with more energy and slightly faster."
                else:
                    suggestion = "You're speaking too fast. Slow down and take pauses to let your message sink in."
        elif data.get("lower_is_better"):
            # For filler words, lower is better
            if avg_score > data["threshold"]:
                is_weak = True
                suggestion = f"Average of {avg_score:.1f} filler words per session. Practice pausing instead of using fillers."
        else:
            # Normal metrics where higher is better
            if avg_score < data["threshold"]:
                is_weak = True
                suggestion = f"Your average score is {avg_score:.1f}/100. Focus on improving this area."
        
        if is_weak:
            weak_areas.append({
                "area": data["name"],
                "average_score": round(avg_score, 2),
                "sessions_analyzed": len(data["scores"]),
                "severity": "high" if avg_score < 50 else "medium",
                "suggestion": suggestion
            })
    
    # Sort by severity and score
    weak_areas.sort(key=lambda x: (x["severity"] == "high", -x["average_score"]), reverse=True)
    
    return {
        "weak_areas": weak_areas[:limit],
        "total_areas_identified": len(weak_areas),
        "sessions_analyzed": len(sessions)
    }