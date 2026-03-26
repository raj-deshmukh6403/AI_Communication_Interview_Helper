"""
feedback_generator.py
=====================
Generates comprehensive feedback reports after interview sessions.

Changes from original:
  - _calculate_aggregate_scores() now reads from new schema field names:
      video_analytics: avg_eye_contact_score, avg_engagement_score
      audio_analytics: avg_speaking_pace_wpm, avg_volume_db,
                       pitch_variation, total_filler_words,
                       speaking_duration_seconds
  - Also reads llm_score and pre_score per response
  - STAR usage now reads from pre_score.star_components_found
  - _build_timeline_data() reads correct field names
  - LLM prompt, strengths/improvements logic, structure all kept exactly
"""

from typing import List, Dict, Any
from datetime import datetime
from .llm_service import LLMService


class FeedbackGenerator:
    """Generates comprehensive feedback reports after interview sessions."""

    def __init__(self):
        self.llm_service = LLMService()

    async def generate_comprehensive_feedback(
        self,
        responses:    List[Dict[str, Any]],
        session_data: Dict[str, Any],
        user_name:    str = "User",
    ) -> Dict[str, Any]:
        """
        Generate comprehensive feedback report for a completed session.

        Args:
            responses   : list of InterviewResponse dicts saved by websocket.py
            session_data: session document from MongoDB
            user_name   : user's full name for personalisation

        Returns:
            Complete feedback report dict saved to session.feedback in MongoDB
        """
        if not responses:
            return self._get_empty_feedback()

        scores = self._calculate_aggregate_scores(responses)
        strengths, improvements = self._identify_strengths_and_improvements(
            responses, scores)

        qualitative_feedback = await self._generate_qualitative_feedback(
            responses, scores, strengths, improvements, user_name)

        timeline_data = self._build_timeline_data(responses)

        return {
            "overall_score": scores["overall_score"],
            "component_scores": {
                "communication":   scores["communication_score"],
                "confidence":      scores["confidence_score"],
                "content_quality": scores["content_quality_score"],
                "non_verbal":      scores["non_verbal_score"],
                "vocal":           scores["vocal_score"],
            },
            "detailed_metrics": {
                "avg_eye_contact":            scores["avg_eye_contact"],
                "avg_engagement":             scores["avg_engagement"],
                "avg_speaking_pace":          scores["avg_speaking_pace"],
                "filler_words_count":         scores["total_filler_words"],
                "total_speaking_time_seconds":scores["total_speaking_time"],
                "avg_answer_relevance":       scores["avg_answer_relevance"],
                "avg_llm_score":              scores["avg_llm_score"],
                "star_method_usage":          scores["star_method_usage"],
            },
            "strengths":         strengths,
            "improvements":      improvements,
            "detailed_feedback": qualitative_feedback,
            "timeline_data":     timeline_data,
            "generated_at":      datetime.utcnow().isoformat(),
        }

    # ─────────────────────────── Score aggregation ───────────────────────────

    def _calculate_aggregate_scores(
        self, responses: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """
        Aggregate metrics from all InterviewResponse dicts.
        Reads from VideoSnapshot + AudioSnapshot field names as saved
        by real_time_monitor.get_answer_snapshot() via websocket.py.
        """
        if not responses:
            return self._get_empty_scores()

        eye_contact_scores  = []
        engagement_scores   = []
        speaking_paces      = []
        volume_levels       = []
        pitch_variations    = []
        filler_counts       = []
        llm_scores          = []
        pre_scores          = []
        answer_relevances   = []
        answer_clarities    = []
        star_usages         = []
        total_speaking_time = 0.0

        for r in responses:
            # ── Video (VideoSnapshot keys) ────────────────────────────────────
            vid = r.get("video_analytics", {})
            if vid:
                if "avg_eye_contact_score" in vid:
                    eye_contact_scores.append(vid["avg_eye_contact_score"])
                if "avg_engagement_score" in vid:
                    engagement_scores.append(vid["avg_engagement_score"])

            # ── Audio (AudioSnapshot keys) ────────────────────────────────────
            aud = r.get("audio_analytics", {})
            if aud:
                if "avg_speaking_pace_wpm" in aud:
                    speaking_paces.append(aud["avg_speaking_pace_wpm"])
                if "avg_volume_db" in aud:
                    volume_levels.append(aud["avg_volume_db"])
                if "pitch_variation" in aud:
                    pitch_variations.append(aud["pitch_variation"])
                if "total_filler_words" in aud:
                    filler_counts.append(aud["total_filler_words"])
                total_speaking_time += aud.get("speaking_duration_seconds", 0)

            # ── LLM score ─────────────────────────────────────────────────────
            llm_score = r.get("llm_score")
            if llm_score is not None:
                llm_scores.append(llm_score)

            # ── Pre-score (AnswerScorer) ───────────────────────────────────────
            pre = r.get("pre_score", {})
            if pre:
                if "composite_pre_score" in pre:
                    pre_scores.append(pre["composite_pre_score"])
                if "relevance_score" in pre:
                    answer_relevances.append(pre["relevance_score"])
                # STAR usage from pre_score.star_components_found
                star_found = len(pre.get("star_components_found", []))
                star_usages.append(star_found / 4 * 100)

            # ── LLM evaluation detail ─────────────────────────────────────────
            ev = r.get("evaluation", {})
            if ev:
                if "clarity_score" in ev:
                    answer_clarities.append(ev["clarity_score"])
                # Also accept star_components from LLM if present
                if "star_components" in ev and not pre:
                    sc = ev["star_components"]
                    star_count = sum([
                        sc.get("has_situation", False),
                        sc.get("has_task",      False),
                        sc.get("has_action",    False),
                        sc.get("has_result",    False),
                    ])
                    star_usages.append(star_count / 4 * 100)

        def avg(lst, default=0):
            return sum(lst) / len(lst) if lst else default

        avg_eye        = avg(eye_contact_scores, 70)
        avg_engagement = avg(engagement_scores,  70)
        avg_pace       = avg(speaking_paces,     150)
        avg_volume     = avg(volume_levels,       50)
        avg_pitch_var  = avg(pitch_variations,    15)
        total_fillers  = sum(filler_counts)
        avg_llm        = avg(llm_scores,          70)
        avg_pre        = avg(pre_scores,          70)
        avg_relevance  = avg(answer_relevances,   75)
        avg_clarity    = avg(answer_clarities,    75)
        avg_star       = avg(star_usages,         50)

        # Component scores
        non_verbal_score = (avg_eye + avg_engagement) / 2

        pace_score = max(0, min(100,
            100 - abs(avg_pace - 150) / 150 * 100))

        volume_score = avg_volume  # already 0-100

        if 10 <= avg_pitch_var <= 30:
            pitch_score = 100.0
        elif avg_pitch_var < 10:
            pitch_score = 50 + (avg_pitch_var / 10 * 50)
        else:
            pitch_score = max(0.0, 100 - (avg_pitch_var - 30))

        filler_penalty = min(30, total_fillers * 2)
        vocal_score = max(0, min(100,
            (pace_score + volume_score + pitch_score) / 3 - filler_penalty))

        content_quality_score = (avg_relevance + avg_clarity + avg_star) / 3
        confidence_score      = (vocal_score + non_verbal_score) / 2
        communication_score   = (
            non_verbal_score    * 0.3 +
            vocal_score         * 0.3 +
            content_quality_score * 0.4
        )
        overall_score = (
            communication_score   +
            confidence_score      +
            content_quality_score
        ) / 3

        return {
            "overall_score":        round(overall_score,        2),
            "communication_score":  round(communication_score,  2),
            "confidence_score":     round(confidence_score,     2),
            "content_quality_score":round(content_quality_score,2),
            "non_verbal_score":     round(non_verbal_score,     2),
            "vocal_score":          round(vocal_score,          2),
            "avg_eye_contact":      round(avg_eye,              2),
            "avg_engagement":       round(avg_engagement,       2),
            "avg_speaking_pace":    round(avg_pace,             2),
            "avg_volume":           round(avg_volume,           2),
            "avg_pitch_variation":  round(avg_pitch_var,        2),
            "total_filler_words":   total_fillers,
            "total_speaking_time":  round(total_speaking_time,  2),
            "avg_answer_relevance": round(avg_relevance,        2),
            "avg_answer_clarity":   round(avg_clarity,          2),
            "avg_llm_score":        round(avg_llm,              2),
            "avg_pre_score":        round(avg_pre,              2),
            "star_method_usage":    round(avg_star,             2),
        }

    # ─────────────────────────── Strengths & improvements ────────────────────

    def _identify_strengths_and_improvements(
        self,
        responses: List[Dict[str, Any]],
        scores:    Dict[str, float],
    ):
        """Identify key strengths and areas for improvement. Kept from original."""
        strengths    = []
        improvements = []

        if scores["avg_eye_contact"] >= 70:
            strengths.append("Maintained good eye contact throughout the interview")
        elif scores["avg_eye_contact"] < 50:
            improvements.append("Practice maintaining eye contact with the camera")

        if 140 <= scores["avg_speaking_pace"] <= 160:
            strengths.append("Spoke at a clear and appropriate pace")
        elif scores["avg_speaking_pace"] > 180:
            improvements.append("Slow down your speaking pace — you tend to speak too quickly")
        elif scores["avg_speaking_pace"] < 120:
            improvements.append("Try to speak a bit faster to maintain energy and engagement")

        if scores["total_filler_words"] < 5:
            strengths.append("Minimal use of filler words — very articulate")
        elif scores["total_filler_words"] > 15:
            improvements.append(
                "Reduce filler words (um, uh, like) by pausing to think before speaking")

        if scores["avg_answer_relevance"] >= 80:
            strengths.append("Provided relevant and on-topic answers")
        elif scores["avg_answer_relevance"] < 60:
            improvements.append("Focus on answering the specific question asked")

        if scores["star_method_usage"] >= 75:
            strengths.append("Effectively used the STAR method in behavioral responses")
        elif scores["star_method_usage"] < 50:
            improvements.append(
                "Structure behavioral answers using STAR method "
                "(Situation, Task, Action, Result)")

        if scores["confidence_score"] >= 75:
            strengths.append("Demonstrated strong confidence in your responses")
        elif scores["confidence_score"] < 60:
            improvements.append(
                "Work on projecting more confidence through voice and body language")

        if scores["avg_engagement"] >= 75:
            strengths.append("Stayed focused and engaged throughout the session")
        elif scores["avg_engagement"] < 50:
            improvements.append(
                "Work on maintaining engagement — avoid looking away from the camera")

        if not strengths:
            strengths.append("You completed the interview — that's an important first step!")

        return strengths, improvements

    # ─────────────────────────── LLM qualitative feedback ────────────────────

    async def _generate_qualitative_feedback(
        self,
        responses:    List[Dict[str, Any]],
        scores:       Dict[str, float],
        strengths:    List[str],
        improvements: List[str],
        user_name:    str,
    ) -> str:
        """Generate detailed qualitative feedback using LLM. Kept from original."""

        prompt = f"""You are an experienced career coach providing feedback on an interview practice session.

User: {user_name}
Overall Score: {scores['overall_score']}/100

Key Strengths:
{chr(10).join(f'- {s}' for s in strengths)}

Areas for Improvement:
{chr(10).join(f'- {i}' for i in improvements)}

Performance Metrics:
- Communication     : {scores['communication_score']}/100
- Confidence        : {scores['confidence_score']}/100
- Content Quality   : {scores['content_quality_score']}/100
- Speaking Pace     : {scores['avg_speaking_pace']} words/minute
- Filler Words      : {scores['total_filler_words']} total
- Avg Answer Score  : {scores['avg_llm_score']}/100
- Eye Contact       : {scores['avg_eye_contact']}/100

Write a comprehensive 3-4 paragraph feedback report that:
1. Starts with an encouraging overview of their performance
2. Discusses their main strengths with specific examples
3. Addresses areas for improvement with actionable advice
4. Ends with motivational next steps

Keep the tone supportive, constructive, and professional."""

        if not self.llm_service.client:
            return self._fallback_feedback(user_name, scores, strengths, improvements)

        try:
            response = self.llm_service.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.llm_service.model,
                temperature=0.7,
                max_tokens=800,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"[FeedbackGenerator] LLM error: {e}")
            return self._fallback_feedback(user_name, scores, strengths, improvements)

    def _fallback_feedback(
        self,
        user_name:    str,
        scores:       Dict[str, float],
        strengths:    List[str],
        improvements: List[str],
    ) -> str:
        """Fallback when LLM unavailable. Kept from original."""
        level = self._get_performance_level(scores["overall_score"])
        s = " ".join(strengths[:2]) if strengths else "You showed effort and commitment."
        i = " ".join(improvements[:2]) if improvements else "Keep practising regularly."
        return (
            f"Great work completing this practice session, {user_name}! "
            f"Your overall performance scored {scores['overall_score']}/100, "
            f"which shows {level}.\n\n"
            f"{s} These are excellent foundations to build upon.\n\n"
            f"To improve further, focus on: {i}. "
            f"These adjustments will help you present yourself even more effectively.\n\n"
            f"Keep practising regularly and you'll see continued improvement!"
        )

    def _get_performance_level(self, score: float) -> str:
        """Kept from original."""
        if score >= 85:   return "excellent mastery of interview skills"
        elif score >= 70: return "strong competency with room for polish"
        elif score >= 55: return "solid fundamentals with areas to develop"
        else:             return "good effort with opportunities for significant improvement"

    # ─────────────────────────── Timeline ────────────────────────────────────

    def _build_timeline_data(
        self, responses: List[Dict[str, Any]]
    ) -> Dict[str, List]:
        """Build per-question time-series data for frontend graphs."""
        timeline = {
            "eye_contact":    [],
            "engagement":     [],
            "speaking_pace":  [],
            "volume":         [],
            "answer_quality": [],
            "emotion":        [],
        }

        for i, r in enumerate(responses):
            q_num = r.get("question_number", i + 1)
            vid   = r.get("video_analytics", {})
            aud   = r.get("audio_analytics", {})
            ev    = r.get("evaluation", {})

            timeline["eye_contact"].append({
                "x": q_num,
                "y": vid.get("avg_eye_contact_score", 0),
            })
            timeline["engagement"].append({
                "x": q_num,
                "y": vid.get("avg_engagement_score", 0),
            })
            timeline["speaking_pace"].append({
                "x": q_num,
                "y": aud.get("avg_speaking_pace_wpm", 0),
            })
            timeline["volume"].append({
                "x": q_num,
                "y": aud.get("avg_volume_db", 0),
            })
            timeline["answer_quality"].append({
                "x": q_num,
                "y": r.get("llm_score") or ev.get("overall_score", 0),
            })
            timeline["emotion"].append({
                "x":       q_num,
                "dominant":vid.get("dominant_emotion", "neutral"),
            })

        return timeline

    # ─────────────────────────── Empty structures ─────────────────────────────

    def _get_empty_feedback(self) -> Dict[str, Any]:
        return {
            "overall_score":    0,
            "component_scores": {
                "communication": 0, "confidence": 0,
                "content_quality": 0, "non_verbal": 0, "vocal": 0,
            },
            "detailed_metrics": {
                "avg_eye_contact": 0, "avg_engagement": 0,
                "avg_speaking_pace": 0, "filler_words_count": 0,
                "total_speaking_time_seconds": 0,
                "avg_answer_relevance": 0, "avg_llm_score": 0,
                "star_method_usage": 0,
            },
            "strengths":         [],
            "improvements":      [],
            "detailed_feedback": "No interview data available to generate feedback.",
            "timeline_data":     {},
            "generated_at":      datetime.utcnow().isoformat(),
        }

    def _get_empty_scores(self) -> Dict[str, float]:
        return {
            "overall_score": 0, "communication_score": 0,
            "confidence_score": 0, "content_quality_score": 0,
            "non_verbal_score": 0, "vocal_score": 0,
            "avg_eye_contact": 0, "avg_engagement": 0,
            "avg_speaking_pace": 0, "avg_volume": 0,
            "avg_pitch_variation": 0, "total_filler_words": 0,
            "total_speaking_time": 0, "avg_answer_relevance": 0,
            "avg_answer_clarity": 0, "avg_llm_score": 0,
            "avg_pre_score": 0, "star_method_usage": 0,
        }