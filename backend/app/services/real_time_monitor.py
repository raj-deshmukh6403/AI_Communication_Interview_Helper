from typing import Dict, Any, Optional
from datetime import datetime
from .video_analyzer import VideoAnalyzer
from .audio_analyzer import AudioAnalyzer
from .llm_service import LLMService
import asyncio
from concurrent.futures import ThreadPoolExecutor

class RealTimeMonitor:
    """
    Coordinates real-time analysis of video and audio streams.
    Generates instant feedback and warnings during the interview.
    """
    
    def __init__(self):
        self.video_analyzer = VideoAnalyzer()
        self.audio_analyzer = AudioAnalyzer()
        self.executor = ThreadPoolExecutor(max_workers=2)
        self.llm_service = LLMService()
        
        # Thresholds for triggering real-time interventions
        self.intervention_cooldown = 15  # seconds between interventions
        self.last_intervention_time = None
        
        # Track issues across frames
        self.issue_counters = {
            "looking_down": 0,
            "looking_up": 0,
            "poor_eye_contact": 0,
            "speaking_too_fast": 0,
            "excessive_movement": 0,
            "low_engagement": 0,
            "nervous": 0,
            "monotone": 0
        }
        
        # Thresholds before intervention
        self.intervention_thresholds = {
            "looking_down": 5,  # 5 consecutive detections
            "looking_up": 5,
            "poor_eye_contact": 10,
            "speaking_too_fast": 3,
            "excessive_movement": 8,
            "low_engagement": 15,
            "nervous": 7,
            "monotone": 10
        }
    
    async def analyze_frame_realtime(
        self, 
        video_frame: str,
        audio_chunk: Optional[str] = None,
        transcript: Optional[str] = None,
        user_name: str = "there"
    ) -> Dict[str, Any]:
        loop = asyncio.get_event_loop()
        """
        Analyze a single frame/moment in real-time.
        
        Args:
            video_frame: Base64 encoded video frame
            audio_chunk: Optional base64 encoded audio
            transcript: Optional transcript of current speech
            user_name: User's name for personalized feedback
        
        Returns:
            Dictionary with analysis results and any interventions needed
        """
        
        result = {
            "timestamp": datetime.utcnow().isoformat(),
            "video_analysis": {},
            "audio_analysis": {},
            "intervention": None,
            "warnings": [],
            "should_interrupt": False
        }
        
        # Analyze video frame
        if video_frame:
            video_analysis = await loop.run_in_executor(
                self.executor,
                self.video_analyzer.analyze_frame,
                video_frame
            )
            result["video_analysis"] = video_analysis
            
            # Update issue counters and check for interventions
            video_intervention = self._check_video_interventions(
                video_analysis, 
                user_name
            )
            
            if video_intervention:
                result["intervention"] = video_intervention
                result["should_interrupt"] = video_intervention.get("interrupt", False)
        
        # Analyze audio chunk
        if audio_chunk:
            audio_analysis = await loop.run_in_executor(
                self.executor,
                self.audio_analyzer.analyze_audio_chunk,
                audio_chunk,
                transcript
            )
            result["audio_analysis"] = audio_analysis
            
            # Check for audio-based interventions
            audio_intervention = self._check_audio_interventions(
                audio_analysis,
                user_name
            )
            
            if audio_intervention and not result["intervention"]:
                result["intervention"] = audio_intervention
                result["should_interrupt"] = audio_intervention.get("interrupt", False)
        
        # Combine warnings from both analyses
        if result["video_analysis"].get("warnings"):
            result["warnings"].extend(result["video_analysis"]["warnings"])
        if result["audio_analysis"].get("warnings"):
            result["warnings"].extend(result["audio_analysis"]["warnings"])
        
        return result
    
    def _check_video_interventions(
        self, 
        video_analysis: Dict[str, Any],
        user_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Check if video issues warrant a real-time intervention.
        
        Returns:
            Intervention dictionary if needed, None otherwise
        """
        
        # Check cooldown period
        if self._is_in_cooldown():
            return None
        
        issues = video_analysis.get("issues", [])
        
        # Update counters
        for issue in self.issue_counters.keys():
            if issue in issues:
                self.issue_counters[issue] += 1
            else:
                self.issue_counters[issue] = max(0, self.issue_counters[issue] - 1)
        
        # Check if any issue exceeds threshold
        for issue, count in self.issue_counters.items():
            threshold = self.intervention_thresholds.get(issue, 10)
            
            if count >= threshold:
                intervention = self._create_intervention(issue, user_name)
                
                # Reset counter after intervention
                self.issue_counters[issue] = 0
                self.last_intervention_time = datetime.utcnow()
                
                return intervention
        
        return None
    
    def _check_audio_interventions(
        self,
        audio_analysis: Dict[str, Any],
        user_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Check if audio issues warrant intervention.
        """
        
        if self._is_in_cooldown():
            return None
        
        issues = audio_analysis.get("issues", [])
        
        # Immediate intervention for critical audio issues
        if "speaking_too_fast" in issues:
            pace = audio_analysis.get("speaking_pace", 0)
            if pace > 200:  # Extremely fast
                self.last_intervention_time = datetime.utcnow()
                return {
                    "type": "speaking_too_fast",
                    "message": f"{user_name}, you seem to be speaking very quickly. Are you feeling nervous? Take a deep breath and slow down.",
                    "severity": "high",
                    "interrupt": True
                }
        
        if "excessive_filler_words" in issues:
            filler_count = audio_analysis.get("filler_words_count", 0)
            if filler_count > 5:
                self.last_intervention_time = datetime.utcnow()
                return {
                    "type": "excessive_fillers",
                    "message": f"{user_name}, I'm noticing you're using a lot of filler words like 'um' and 'uh'. Take your time to think before you speak.",
                    "severity": "medium",
                    "interrupt": False
                }
        
        if "monotone_speech" in issues:
            self.issue_counters["monotone"] += 1
            if self.issue_counters["monotone"] >= self.intervention_thresholds["monotone"]:
                self.issue_counters["monotone"] = 0
                self.last_intervention_time = datetime.utcnow()
                return {
                    "type": "monotone",
                    "message": f"{user_name}, try to vary your tone and energy to sound more engaging.",
                    "severity": "medium",
                    "interrupt": False
                }
        
        return None
    
    def _create_intervention(self, issue: str, user_name: str) -> Dict[str, Any]:
        """
        Create an intervention message based on the issue type.
        """
        
        interventions = {
            "looking_down": {
                "type": "looking_down",
                "message": f"{user_name}, I notice you're looking down frequently. Are you distracted? Try to maintain eye contact with the camera.",
                "severity": "medium",
                "interrupt": True
            },
            "looking_up": {
                "type": "looking_up",
                "message": f"{user_name}, please look at the camera rather than looking up. This will help maintain better eye contact.",
                "severity": "medium",
                "interrupt": True
            },
            "poor_eye_contact": {
                "type": "poor_eye_contact",
                "message": f"{user_name}, try to look directly at the camera. Good eye contact is important in interviews.",
                "severity": "high",
                "interrupt": True
            },
            "excessive_movement": {
                "type": "fidgeting",
                "message": f"{user_name}, you seem to be moving around quite a bit. Are you feeling nervous? Try to stay still and composed.",
                "severity": "medium",
                "interrupt": True
            },
            "low_engagement": {
                "type": "low_engagement",
                "message": f"{user_name}, you seem a bit distracted. Let's refocus on the interview question.",
                "severity": "high",
                "interrupt": True
            },
            "nervous": {
                "type": "nervousness",
                "message": f"{user_name}, take a deep breath. It's okay to pause and collect your thoughts.",
                "severity": "medium",
                "interrupt": True
            }
        }
        
        return interventions.get(issue, {
            "type": "general",
            "message": f"{user_name}, let's take a moment to refocus.",
            "severity": "low",
            "interrupt": False
        })
    
    def _is_in_cooldown(self) -> bool:
        """Check if we're still in cooldown period from last intervention."""
        if self.last_intervention_time is None:
            return False
        
        time_since_last = (datetime.utcnow() - self.last_intervention_time).total_seconds()
        return time_since_last < self.intervention_cooldown
    
    def get_session_summary(self) -> Dict[str, Any]:
        """
        Get summary of all analytics from the session.
        """
        return {
            "video_summary": {
                "total_frames_analyzed": self.video_analyzer.frame_count
            },
            "audio_summary": self.audio_analyzer.get_session_statistics(),
            "issue_history": dict(self.issue_counters)
        }
    
    def reset(self):
        """Reset monitor for a new session."""
        self.video_analyzer.reset()
        self.audio_analyzer.reset()
        self.issue_counters = {key: 0 for key in self.issue_counters}
        self.last_intervention_time = None