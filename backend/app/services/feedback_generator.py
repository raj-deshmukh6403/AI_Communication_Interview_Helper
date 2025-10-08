# from typing import List, Dict, Any
# from datetime import datetime
# from .llm_service import LLMService
# import statistics

# class FeedbackGenerator:
#     """
#     Generates comprehensive feedback reports after interview sessions.
#     Analyzes all collected data and provides constructive criticism.
#     """
    
#     def __init__(self):
#         self.llm_service = LLMService()
    
#     async def generate_comprehensive_feedback(
#         self,
#         responses: List[Dict[str, Any]],
#         session_data: Dict[str, Any],
#         user_name: str = "User"
#     ) -> Dict[str, Any]:
#         """
#         Generate a complete feedback report for the interview session.
        
#         Args:
#             responses: List of all question-answer pairs with analytics
#             session_data: Session metadata (job description, position, etc.)
#             user_name: User's name for personalization
        
#         Returns:
#             Comprehensive feedback dictionary
#         """
        
#         if not responses:
#             return self._get_empty_feedback()
        
#         # Aggregate all metrics
#         aggregated_metrics = self._aggregate_metrics(responses)
        
#         # Calculate component scores
#         communication_score = self._calculate_communication_score(aggregated_metrics)
#         confidence_score = self._calculate_confidence_score(aggregated_metrics)
#         content_quality_score = self._calculate_content_quality_score(responses)
        
#         # Overall score (weighted average)
#         overall_score = (
#             communication_score * 0.3 +
#             confidence_score * 0.3 +
#             content_quality_score * 0.4
#         )
        
#         # Identify strengths and areas for improvement
#         strengths = self._identify_strengths(aggregated_metrics, responses)
#         improvements = self._identify_improvements(aggregated_metrics, responses)
        
#         # Generate detailed textual feedback using LLM
#         detailed_feedback = await self._generate_detailed_feedback_text(
#             responses=responses,
#             metrics=aggregated_metrics,
#             strengths=strengths,
#             improvements=improvements,
#             user_name=user_name,
#             position=session_data.get("position", "this position")
#         )
        
#         # Build timeline for visualization
#         analytics_timeline = self._build_analytics_timeline(responses)
        
#         return {
#             "overall_score": round(overall_score, 2),
#             "communication_score": round(communication_score, 2),
#             "confidence_score": round(confidence_score, 2),
#             "content_quality_score": round(content_quality_score, 2),
            
#             "metrics": {
#                 "avg_eye_contact": aggregated_metrics["avg_eye_contact"],
#                 "avg_speaking_pace": aggregated_metrics["avg_speaking_pace"],
#                 "avg_volume": aggregated_metrics["avg_volume"],
#                 "filler_words_count": aggregated_metrics["total_filler_words"],
#                 "total_speaking_time_seconds": aggregated_metrics["total_speaking_time"],
#                 "avg_engagement": aggregated_metrics["avg_engagement"]
#             },
            
#             "strengths": strengths,
#             "improvements": improvements,
#             "detailed_feedback": detailed_feedback,
            
#             "analytics_timeline": analytics_timeline,
            
#             "recommendations": self._generate_recommendations(improvements),
            
#             "generated_at": datetime.utcnow().isoformat()
#         }
    
#     def _aggregate_metrics(self, responses: List[Dict[str, Any]]) -> Dict[str, float]:
#         """
#         Aggregate all metrics from responses into summary statistics.
#         """
        
#         # Extract video metrics
#         eye_contact_scores = []
#         engagement_scores = []
        
#         for response in responses:
#             video_analytics = response.get("video_analytics", {})
#             if "eye_contact_score" in video_analytics:
#                 eye_contact_scores.append(video_analytics["eye_contact_score"])
#             if "engagement_score" in video_analytics:
#                 engagement_scores.append(video_analytics["engagement_score"])
        
#         # Extract audio metrics
#         speaking_paces = []
#         volumes = []
#         total_filler_words = 0
#         total_speaking_time = 0
        
#         for response in responses:
#             audio_analytics = response.get("audio_analytics", {})
            
#             if "average_speaking_pace" in audio_analytics:
#                 speaking_paces.append(audio_analytics["average_speaking_pace"])
#             if "average_volume" in audio_analytics:
#                 volumes.append(audio_analytics["average_volume"])
            
#             total_filler_words += audio_analytics.get("total_filler_words", 0)
#             total_speaking_time += audio_analytics.get("total_speaking_time_seconds", 0)
        
#         return {
#             "avg_eye_contact": round(statistics.mean(eye_contact_scores), 2) if eye_contact_scores else 0,
#             "avg_speaking_pace": round(statistics.mean(speaking_paces), 2) if speaking_paces else 0,
#             "avg_volume": round(statistics.mean(volumes), 2) if volumes else 0,
#             "total_filler_words": total_filler_words,
#             "total_speaking_time": round(total_speaking_time, 2),
#             "avg_engagement": round(statistics.mean(engagement_scores), 2) if engagement_scores else 0,
#         }
    
#     def _calculate_communication_score(self, metrics: Dict[str, float]) -> float:
#         """
#         Calculate communication effectiveness score based on verbal and non-verbal cues.
#         """
        
#         # Eye contact (0-100)
#         eye_contact_score = metrics["avg_eye_contact"]
        
#         # Speaking pace score (optimal is 140-160 wpm)
#         pace = metrics["avg_speaking_pace"]
#         if 140 <= pace <= 160:
#             pace_score = 100
#         elif 120 <= pace < 140 or 160 < pace <= 180:
#             pace_score = 80
#         elif pace < 120 or pace > 180:
#             pace_score = 50
#         else:
#             pace_score = 70
        
#         # Filler words penalty
#         filler_rate = metrics["total_filler_words"] / (metrics["total_speaking_time"] / 60) if metrics["total_speaking_time"] > 0 else 0
#         if filler_rate < 2:  # Less than 2 per minute
#             filler_score = 100
#         elif filler_rate < 5:
#             filler_score = 70
#         else:
#             filler_score = 40
        
#         # Weighted average
#         communication_score = (
#             eye_contact_score * 0.4 +
#             pace_score * 0.3 +
#             filler_score * 0.3
#         )
        
#         return communication_score
    
#     def _calculate_confidence_score(self, metrics: Dict[str, float]) -> float:
#         """
#         Calculate confidence level based on body language and voice characteristics.
#         """
        
#         # Engagement score
#         engagement = metrics["avg_engagement"]
        
#         # Volume consistency (speaking at good volume)
#         volume = metrics["avg_volume"]
#         if 40 <= volume <= 80:
#             volume_score = 100
#         elif 30 <= volume < 40 or 80 < volume <= 90:
#             volume_score = 75
#         else:
#             volume_score = 50
        
#         # Weighted average
#         confidence_score = (
#             engagement * 0.6 +
#             volume_score * 0.4
#         )
        
#         return confidence_score
    
#     def _calculate_content_quality_score(self, responses: List[Dict[str, Any]]) -> float:
#         """
#         Calculate content quality based on LLM evaluations of answers.
#         """
        
#         evaluations = []
        
#         for response in responses:
#             evaluation = response.get("evaluation", {})
#             if "overall_score" in evaluation:
#                 evaluations.append(evaluation["overall_score"])
        
#         if not evaluations:
#             return 70.0  # Default if no evaluations
        
#         return round(statistics.mean(evaluations), 2)
    
#     def _identify_strengths(
#         self, 
#         metrics: Dict[str, float], 
#         responses: List[Dict[str, Any]]
#     ) -> List[str]:
#         """
#         Identify key strengths demonstrated in the interview.
#         """
        
#         strengths = []
        
#         # Eye contact
#         if metrics["avg_eye_contact"] >= 75:
#             strengths.append("Excellent eye contact - you maintained strong visual engagement throughout")
        
#         # Speaking pace
#         pace = metrics["avg_speaking_pace"]
#         if 140 <= pace <= 160:
#             strengths.append("Optimal speaking pace - your delivery was clear and well-paced")
        
#         # Filler words
#         filler_rate = metrics["total_filler_words"] / (metrics["total_speaking_time"] / 60) if metrics["total_speaking_time"] > 0 else 0
#         if filler_rate < 2:
#             strengths.append("Minimal use of filler words - your speech was articulate and confident")
        
#         # Engagement
#         if metrics["avg_engagement"] >= 75:
#             strengths.append("High engagement level - you appeared focused and interested throughout")
        
#         # Content quality from evaluations
#         content_scores = [
#             r.get("evaluation", {}).get("overall_score", 0) 
#             for r in responses 
#             if r.get("evaluation")
#         ]
#         if content_scores and statistics.mean(content_scores) >= 80:
#             strengths.append("Strong answer quality - your responses were relevant and well-structured")
        
#         # If no specific strengths identified
#         if not strengths:
#             strengths.append("You completed the interview - that's an important first step!")
        
#         return strengths
    
#     def _identify_improvements(
#         self,
#         metrics: Dict[str, float],
#         responses: List[Dict[str, Any]]
#     ) -> List[str]:
#         """
#         Identify areas that need improvement.
#         """
        
#         improvements = []
        
#         # Eye contact
#         if metrics["avg_eye_contact"] < 50:
#             improvements.append({
#                 "area": "Eye Contact",
#                 "issue": "Your eye contact needs significant improvement",
#                 "suggestion": "Practice looking directly at the camera. Imagine you're talking to a friend through video call."
#             })
#         elif metrics["avg_eye_contact"] < 75:
#             improvements.append({
#                 "area": "Eye Contact",
#                 "issue": "Eye contact could be more consistent",
#                 "suggestion": "Try to maintain focus on the camera for longer periods. Brief glances away are fine, but return to the camera quickly."
#             })
        
#         # Speaking pace
#         pace = metrics["avg_speaking_pace"]
#         if pace > 180:
#             improvements.append({
#                 "area": "Speaking Pace",
#                 "issue": "You're speaking too quickly",
#                 "suggestion": "Slow down and take pauses between thoughts. This shows confidence and helps your message land better."
#             })
#         elif pace < 120:
#             improvements.append({
#                 "area": "Speaking Pace",
#                 "issue": "Your speaking pace is a bit slow",
#                 "suggestion": "Try to speak slightly faster and with more energy. Practice reading aloud to find your natural rhythm."
#             })
        
#         # Filler words
#         filler_rate = metrics["total_filler_words"] / (metrics["total_speaking_time"] / 60) if metrics["total_speaking_time"] > 0 else 0
#         if filler_rate > 5:
#             improvements.append({
#                 "area": "Filler Words",
#                 "issue": "Excessive use of filler words (um, uh, like)",
#                 "suggestion": "Practice pausing instead of using fillers. It's okay to think silently for a moment before answering."
#             })
        
#         # Volume
#         if metrics["avg_volume"] < 30:
#             improvements.append({
#                 "area": "Voice Volume",
#                 "issue": "Your voice is too quiet",
#                 "suggestion": "Speak louder and project your voice. Good volume conveys confidence and ensures you're heard clearly."
#             })
        
#         # Engagement
#         if metrics["avg_engagement"] < 60:
#             improvements.append({
#                 "area": "Engagement",
#                 "issue": "You appeared distracted or disengaged at times",
#                 "suggestion": "Stay focused on the interviewer and the questions. Show enthusiasm through your body language and facial expressions."
#             })
        
#         # Content quality
#         content_scores = [
#             r.get("evaluation", {}).get("overall_score", 0)
#             for r in responses
#             if r.get("evaluation")
#         ]
#         if content_scores and statistics.mean(content_scores) < 60:
#             improvements.append({
#                 "area": "Answer Quality",
#                 "issue": "Your answers could be more structured and relevant",
#                 "suggestion": "Use the STAR method (Situation, Task, Action, Result) for behavioral questions. Provide specific examples."
#             })
        
#         return improvements
    
#     async def _generate_detailed_feedback_text(
#         self,
#         responses: List[Dict[str, Any]],
#         metrics: Dict[str, float],
#         strengths: List[str],
#         improvements: List[Dict[str, Any]],
#         user_name: str,
#         position: str
#     ) -> str:
#         """
#         Generate a detailed, personalized feedback summary using LLM.
#         """
        
#         prompt = f"""You are an expert interview coach. Write a detailed, encouraging feedback report for {user_name} who just completed a mock interview for a {position} position.

# Key Metrics:
# - Eye Contact: {metrics['avg_eye_contact']}/100
# - Speaking Pace: {metrics['avg_speaking_pace']} words/minute
# - Engagement: {metrics['avg_engagement']}/100
# - Filler Words: {metrics['total_filler_words']} total

# Strengths:
# {chr(10).join('- ' + s for s in strengths)}

# Areas for Improvement:
# {chr(10).join(f"- {imp['area']}: {imp['issue']}" for imp in improvements)}

# Write a warm, constructive 3-4 paragraph feedback summary that:
# 1. Starts with encouragement and acknowledges their effort
# 2. Highlights their key strengths
# 3. Addresses areas for improvement with specific, actionable advice
# 4. Ends with motivation and next steps

# Keep it professional but friendly, like a mentor talking to a mentee. Maximum 250 words."""

#         if not self.llm_service.client:
#             # Fallback feedback if LLM unavailable
#             return self._generate_fallback_feedback(user_name, strengths, improvements)
        
#         try:
#             response = self.llm_service.client.chat.completions.create(
#                 messages=[{"role": "user", "content": prompt}],
#                 model=self.llm_service.model,
#                 temperature=0.7,
#                 max_tokens=400
#             )
            
#             return response.choices[0].message.content.strip()
            
#         except Exception as e:
#             print(f"Error generating detailed feedback: {e}")
#             return self._generate_fallback_feedback(user_name, strengths, improvements)
    
#     def _generate_fallback_feedback(
#         self,
#         user_name: str,
#         strengths: List[str],
#         improvements: List[Dict[str, Any]]
#     ) -> str:
#         """
#         Generate basic feedback when LLM is unavailable.
#         """
        
#         feedback = f"Great job completing your interview practice, {user_name}! Here's your feedback:\n\n"
        
#         feedback += "Your Strengths:\n"
#         for strength in strengths[:3]:
#             feedback += f"• {strength}\n"
        
#         feedback += "\nAreas to Focus On:\n"
#         for improvement in improvements[:3]:
#             feedback += f"• {improvement['area']}: {improvement['suggestion']}\n"
        
#         feedback += "\nKeep practicing and you'll continue to improve! Each session builds your confidence and skills."
        
#         return feedback
    
#     def _build_analytics_timeline(self, responses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
#         """
#         Build a timeline of analytics snapshots for visualization.
#         """
        
#         timeline = []
        
#         for i, response in enumerate(responses):
#             video_analytics = response.get("video_analytics", {})
#             audio_analytics = response.get("audio_analytics", {})
            
#             snapshot = {
#                 "timestamp": response.get("timestamp", datetime.utcnow()).isoformat(),
#                 "question_number": i + 1,
#                 "eye_contact_score": video_analytics.get("eye_contact_score", 0),
#                 "engagement_score": video_analytics.get("engagement_score", 0),
#                 "speaking_pace": audio_analytics.get("average_speaking_pace", 0),
#                 "volume_level": audio_analytics.get("average_volume", 0),
#                 "issues": response.get("video_analytics", {}).get("issues", []) + response.get("audio_analytics", {}).get("issues", [])
#             }
            
#             timeline.append(snapshot)
        
#         return timeline
    
#     def _generate_recommendations(self, improvements: List[Dict[str, Any]]) -> List[str]:
#         """
#         Generate actionable recommendations for practice.
#         """
        
#         recommendations = []
        
#         # Based on improvements needed
#         improvement_areas = [imp["area"] for imp in improvements]
        
#         if "Eye Contact" in improvement_areas:
#             recommendations.append("Practice speaking to your webcam while recording yourself. Review the footage to check your eye contact.")
        
#         if "Speaking Pace" in improvement_areas:
#             recommendations.append("Record yourself reading a passage aloud. Count words per minute and adjust your pace accordingly.")
        
#         if "Filler Words" in improvement_areas:
#             recommendations.append("Practice the 'pause technique' - when you feel like saying 'um', take a silent breath instead.")
        
#         if "Voice Volume" in improvement_areas:
#             recommendations.append("Practice speaking with projection. Record yourself and ensure you can hear yourself clearly without straining.")
        
#         if "Answer Quality" in improvement_areas:
#             recommendations.append("Prepare using the STAR method. Write down 3-5 stories from your experience following this structure.")
        
#         # General recommendations
#         recommendations.append("Schedule another practice session within 3-5 days to reinforce improvements.")
#         recommendations.append("Review common interview questions for your target role and prepare specific examples.")
        
#         return recommendations[:5]  # Limit to 5 recommendations
    
#     def _get_empty_feedback(self) -> Dict[str, Any]:
#         """
#         Return empty feedback structure when no responses available.
#         """
        
#         return {
#             "overall_score": 0,
#             "communication_score": 0,
#             "confidence_score": 0,
#             "content_quality_score": 0,
#             "metrics": {
#                 "avg_eye_contact": 0,
#                 "avg_speaking_pace": 0,
#                 "avg_volume": 0,
#                 "filler_words_count": 0,
#                 "total_speaking_time_seconds": 0,
#                 "avg_engagement": 0
#             },
#             "strengths": [],
#             "improvements": [],
#             "detailed_feedback": "No interview data available to generate feedback.",
#             "analytics_timeline": [],
#             "recommendations": [],
#             "generated_at": datetime.utcnow().isoformat()
#         }
from typing import List, Dict, Any
from datetime import datetime
from .llm_service import LLMService

class FeedbackGenerator:
    """
    Generates comprehensive feedback reports after interview sessions.
    """
    
    def __init__(self):
        self.llm_service = LLMService()
    
    async def generate_comprehensive_feedback(
        self,
        responses: List[Dict[str, Any]],
        session_data: Dict[str, Any],
        user_name: str = "User"
    ) -> Dict[str, Any]:
        """
        Generate comprehensive feedback report for completed session.
        
        Args:
            responses: List of all question-answer pairs with analytics
            session_data: Session metadata (job description, position, etc.)
            user_name: User's name for personalization
        
        Returns:
            Dictionary with complete feedback report
        """
        
        # Calculate aggregate scores
        scores = self._calculate_aggregate_scores(responses)
        
        # Identify strengths and weaknesses
        strengths, improvements = self._identify_strengths_and_improvements(responses, scores)
        
        # Generate qualitative feedback using LLM
        qualitative_feedback = await self._generate_qualitative_feedback(
            responses,
            scores,
            strengths,
            improvements,
            user_name
        )
        
        # Build timeline data for graphs
        timeline_data = self._build_timeline_data(responses)
        
        # Compile final report
        report = {
            "overall_score": scores["overall_score"],
            "component_scores": {
                "communication": scores["communication_score"],
                "confidence": scores["confidence_score"],
                "content_quality": scores["content_quality_score"],
                "non_verbal": scores["non_verbal_score"],
                "vocal": scores["vocal_score"]
            },
            "detailed_metrics": {
                "avg_eye_contact": scores["avg_eye_contact"],
                "avg_speaking_pace": scores["avg_speaking_pace"],
                "filler_words_count": scores["total_filler_words"],
                "total_speaking_time_seconds": scores["total_speaking_time"],
                "avg_answer_relevance": scores["avg_answer_relevance"],
                "star_method_usage": scores["star_method_usage"]
            },
            "strengths": strengths,
            "improvements": improvements,
            "detailed_feedback": qualitative_feedback,
            "timeline_data": timeline_data,
            "generated_at": datetime.utcnow().isoformat()
        }
        
        return report
    
    def _calculate_aggregate_scores(self, responses: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculate aggregate scores from all responses."""
        
        if not responses:
            return self._get_empty_scores()
        
        # Extract metrics from all responses
        eye_contact_scores = []
        engagement_scores = []
        speaking_paces = []
        volume_levels = []
        pitch_variations = []
        filler_words_counts = []
        answer_relevances = []
        answer_clarities = []
        star_usages = []
        
        total_speaking_time = 0
        
        for response in responses:
            video_analytics = response.get("video_analytics", {})
            audio_analytics = response.get("audio_analytics", {})
            evaluation = response.get("evaluation", {})
            
             # FIX: Extract video metrics correctly
            if video_analytics:
                # Check if it's real-time data structure
                if "eye_contact_score" in video_analytics:
                    eye_contact_scores.append(video_analytics["eye_contact_score"])
                if "engagement_score" in video_analytics:
                    engagement_scores.append(video_analytics["engagement_score"])
            
            # Video metrics
            if "video_summary" in video_analytics:
                # If we have summary data, use it
                pass
            
            # Audio metrics
            if audio_analytics:
                if "average_speaking_pace" in audio_analytics:
                    speaking_paces.append(audio_analytics["average_speaking_pace"])
                if "average_volume" in audio_analytics:
                    volume_levels.append(audio_analytics["average_volume"])
                if "pitch_variation" in audio_analytics:
                    pitch_variations.append(audio_analytics["pitch_variation"])
                if "total_filler_words" in audio_analytics:
                    filler_words_counts.append(audio_analytics["total_filler_words"])
                if "total_speaking_time_seconds" in audio_analytics:
                    total_speaking_time += audio_analytics["total_speaking_time_seconds"]
            
            # Content quality metrics
            if evaluation:
                if "relevance_score" in evaluation:
                    answer_relevances.append(evaluation["relevance_score"])
                if "clarity_score" in evaluation:
                    answer_clarities.append(evaluation["clarity_score"])
                if "star_components" in evaluation:
                    star_comp = evaluation["star_components"]
                    star_count = sum([
                        star_comp.get("has_situation", False),
                        star_comp.get("has_task", False),
                        star_comp.get("has_action", False),
                        star_comp.get("has_result", False)
                    ])
                    star_usages.append(star_count / 4 * 100)
        
        # Calculate averages
        avg_eye_contact = sum(eye_contact_scores) / len(eye_contact_scores) if eye_contact_scores else 70
        avg_engagement = sum(engagement_scores) / len(engagement_scores) if engagement_scores else 70
        avg_speaking_pace = sum(speaking_paces) / len(speaking_paces) if speaking_paces else 150
        avg_volume = sum(volume_levels) / len(volume_levels) if volume_levels else 50
        avg_pitch_variation = sum(pitch_variations) / len(pitch_variations) if pitch_variations else 15
        total_filler_words = sum(filler_words_counts)
        avg_answer_relevance = sum(answer_relevances) / len(answer_relevances) if answer_relevances else 75
        avg_answer_clarity = sum(answer_clarities) / len(answer_clarities) if answer_clarities else 75
        avg_star_usage = sum(star_usages) / len(star_usages) if star_usages else 50
        
        # Calculate component scores
        # Non-verbal score (eye contact + engagement)
        non_verbal_score = (avg_eye_contact + avg_engagement) / 2
        
        # Vocal score (pace + volume + pitch variation)
        pace_score = 100 - abs(avg_speaking_pace - 150) / 150 * 100  # Optimal pace is 150 WPM
        pace_score = max(0, min(100, pace_score))
        
        volume_score = avg_volume  # Already 0-100
        
        # Pitch variation score (10-30% is good)
        if 10 <= avg_pitch_variation <= 30:
            pitch_score = 100
        elif avg_pitch_variation < 10:
            pitch_score = 50 + (avg_pitch_variation / 10 * 50)
        else:
            pitch_score = max(0, 100 - (avg_pitch_variation - 30))
        
        # Filler words penalty
        filler_penalty = min(30, total_filler_words * 2)  # Max 30 point penalty
        
        vocal_score = (pace_score + volume_score + pitch_score) / 3 - filler_penalty
        vocal_score = max(0, min(100, vocal_score))
        
        # Content quality score
        content_quality_score = (avg_answer_relevance + avg_answer_clarity + avg_star_usage) / 3
        
        # Confidence score (combination of vocal and non-verbal)
        confidence_score = (vocal_score + non_verbal_score) / 2
        
        # Communication score (all factors)
        communication_score = (non_verbal_score * 0.3 + vocal_score * 0.3 + content_quality_score * 0.4)
        
        # Overall score
        overall_score = (communication_score + confidence_score + content_quality_score) / 3
        
        return {
            "overall_score": round(overall_score, 2),
            "communication_score": round(communication_score, 2),
            "confidence_score": round(confidence_score, 2),
            "content_quality_score": round(content_quality_score, 2),
            "non_verbal_score": round(non_verbal_score, 2),
            "vocal_score": round(vocal_score, 2),
            "avg_eye_contact": round(avg_eye_contact, 2),
            "avg_engagement": round(avg_engagement, 2),
            "avg_speaking_pace": round(avg_speaking_pace, 2),
            "avg_volume": round(avg_volume, 2),
            "avg_pitch_variation": round(avg_pitch_variation, 2),
            "total_filler_words": total_filler_words,
            "total_speaking_time": round(total_speaking_time, 2),
            "avg_answer_relevance": round(avg_answer_relevance, 2),
            "avg_answer_clarity": round(avg_answer_clarity, 2),
            "star_method_usage": round(avg_star_usage, 2)
        }
    
    def _identify_strengths_and_improvements(
        self,
        responses: List[Dict[str, Any]],
        scores: Dict[str, float]
    ) -> tuple:
        """Identify key strengths and areas for improvement."""
        
        strengths = []
        improvements = []
        
        # Eye contact
        if scores["avg_eye_contact"] >= 70:
            strengths.append("Maintained good eye contact throughout the interview")
        elif scores["avg_eye_contact"] < 50:
            improvements.append("Practice maintaining eye contact with the camera")
        
        # Speaking pace
        if 140 <= scores["avg_speaking_pace"] <= 160:
            strengths.append("Spoke at a clear and appropriate pace")
        elif scores["avg_speaking_pace"] > 180:
            improvements.append("Slow down your speaking pace - you tend to speak too quickly")
        elif scores["avg_speaking_pace"] < 120:
            improvements.append("Try to speak a bit faster to maintain energy and engagement")
        
        # Filler words
        if scores["total_filler_words"] < 5:
            strengths.append("Minimal use of filler words - very articulate")
        elif scores["total_filler_words"] > 15:
            improvements.append("Reduce filler words (um, uh, like) by pausing to think before speaking")
        
        # Content quality
        if scores["avg_answer_relevance"] >= 80:
            strengths.append("Provided relevant and on-topic answers")
        elif scores["avg_answer_relevance"] < 60:
            improvements.append("Focus on answering the specific question asked")
        
        # STAR method
        if scores["star_method_usage"] >= 75:
            strengths.append("Effectively used the STAR method in behavioral responses")
        elif scores["star_method_usage"] < 50:
            improvements.append("Structure behavioral answers using STAR method (Situation, Task, Action, Result)")
        
        # Confidence
        if scores["confidence_score"] >= 75:
            strengths.append("Demonstrated strong confidence in your responses")
        elif scores["confidence_score"] < 60:
            improvements.append("Work on projecting more confidence through voice and body language")
        
        return strengths, improvements
    
    async def _generate_qualitative_feedback(
        self,
        responses: List[Dict[str, Any]],
        scores: Dict[str, float],
        strengths: List[str],
        improvements: List[str],
        user_name: str
    ) -> str:
        """Generate detailed qualitative feedback using LLM."""
        
        prompt = f"""You are an experienced career coach providing feedback on an interview practice session.

User: {user_name}
Overall Score: {scores['overall_score']}/100

Key Strengths:
{chr(10).join(f'- {s}' for s in strengths)}

Areas for Improvement:
{chr(10).join(f'- {i}' for i in improvements)}

Performance Metrics:
- Communication: {scores['communication_score']}/100
- Confidence: {scores['confidence_score']}/100
- Content Quality: {scores['content_quality_score']}/100
- Speaking Pace: {scores['avg_speaking_pace']} words/minute
- Filler Words: {scores['total_filler_words']} total

Write a comprehensive 3-4 paragraph feedback report that:
1. Starts with an encouraging overview of their performance
2. Discusses their main strengths with specific examples
3. Addresses areas for improvement with actionable advice
4. Ends with motivational next steps

Keep the tone supportive, constructive, and professional."""

        try:
            response = self.llm_service.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.llm_service.model,
                temperature=0.7,
                max_tokens=800
            )
            
            return response.choices[0].message.content.strip()
        except:
            # Fallback feedback
            return f"""Great work on completing this practice session, {user_name}! Your overall performance scored {scores['overall_score']}/100, which shows {self._get_performance_level(scores['overall_score'])}. 

{' '.join(strengths[:2])}. These are excellent foundations to build upon.

To improve further, focus on: {' '.join(improvements[:2])}. These adjustments will help you present yourself even more effectively.

Keep practicing regularly, and you'll see continued improvement in your interview skills!"""
    
    def _get_performance_level(self, score: float) -> str:
        """Get performance level description from score."""
        if score >= 85:
            return "excellent mastery of interview skills"
        elif score >= 70:
            return "strong competency with room for polish"
        elif score >= 55:
            return "solid fundamentals with areas to develop"
        else:
            return "good effort with opportunities for significant improvement"
    
    def _build_timeline_data(self, responses: List[Dict[str, Any]]) -> Dict[str, List]:
        """Build time-series data for graphs."""
        
        timeline = {
            "eye_contact": [],
            "engagement": [],
            "speaking_pace": [],
            "volume": [],
            "answer_quality": []
        }
        
        for i, response in enumerate(responses):
            timestamp = i + 1  # Question number
            
            audio = response.get("audio_analytics", {})
            evaluation = response.get("evaluation", {})
            
            timeline["speaking_pace"].append({
                "x": timestamp,
                "y": audio.get("average_speaking_pace", 150)
            })
            
            timeline["volume"].append({
                "x": timestamp,
                "y": audio.get("average_volume", 50)
            })
            
            timeline["answer_quality"].append({
                "x": timestamp,
                "y": evaluation.get("overall_score", 75)
            })
        
        return timeline
    
    def _get_empty_scores(self) -> Dict[str, float]:
        """Return empty scores structure."""
        return {
            "overall_score": 0,
            "communication_score": 0,
            "confidence_score": 0,
            "content_quality_score": 0,
            "non_verbal_score": 0,
            "vocal_score": 0,
            "avg_eye_contact": 0,
            "avg_engagement": 0,
            "avg_speaking_pace": 0,
            "avg_volume": 0,
            "avg_pitch_variation": 0,
            "total_filler_words": 0,
            "total_speaking_time": 0,
            "avg_answer_relevance": 0,
            "avg_answer_clarity": 0,
            "star_method_usage": 0
        }