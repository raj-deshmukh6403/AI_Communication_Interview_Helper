# import cv2
# import mediapipe as mp
# import numpy as np
# from typing import Dict, Any, List
# import base64
# from datetime import datetime

# # Try to import DeepFace, but make it optional
# DEEPFACE_AVAILABLE = False
# try:
#     from deepface import DeepFace
#     DEEPFACE_AVAILABLE = True
#     print("✓ DeepFace loaded successfully")
# except ImportError:
#     print("⚠ DeepFace not available - emotion analysis will be disabled")
# except Exception as e:
#     print(f"⚠ DeepFace initialization error: {e}")
    
    

# class VideoAnalyzer:
#     """
#     Analyzes video frames for facial features, emotions, eye contact, and non-verbal cues.
#     Uses MediaPipe (free) for face landmarks and DeepFace for emotion recognition.
#     """
    
#     def __init__(self):
#         # Initialize MediaPipe Face Mesh
#         self.mp_face_mesh = mp.solutions.face_mesh
#         self.face_mesh = self.mp_face_mesh.FaceMesh(
#             max_num_faces=1,
#             refine_landmarks=True,
#             min_detection_confidence=0.5,
#             min_tracking_confidence=0.5
#         )
        
#         # Track previous frames for motion detection
#         self.previous_landmarks = None
#         self.frame_count = 0
        
#         # Track emotions over time
#         self.emotion_history = []
#         self.max_emotion_history = 30  # Keep last 30 detections
        
#         # Frame skip for DeepFace (it's slower)
#         self.emotion_analysis_interval = 5  # Analyze emotion every 5 frames
        
#     def analyze_frame(self, frame_data: str) -> Dict[str, Any]:
#         """
#         Analyze a single video frame for facial features, emotions, and behavior.
        
#         Args:
#             frame_data: Base64 encoded image string
        
#         Returns:
#             Dictionary containing analysis results
#         """
#         try:
#             # Decode base64 image
#             if ',' in frame_data:
#                 frame_data = frame_data.split(',')[1]
            
#             img_data = base64.b64decode(frame_data)
#             nparr = np.frombuffer(img_data, np.uint8)
#             image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
#             if image is None:
#                 return self._get_empty_result("Invalid image data")
            
#             # Convert BGR to RGB for MediaPipe
#             rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
#             # Process with MediaPipe Face Mesh
#             results = self.face_mesh.process(rgb_image)
            
#             analysis = {
#                 "timestamp": datetime.utcnow().isoformat(),
#                 "face_detected": False,
#                 "eye_contact_score": 0.0,
#                 "head_position": "unknown",
#                 "head_movement": "stable",
#                 "engagement_score": 0.0,
#                 "emotions": {},
#                 "dominant_emotion": "neutral",
#                 "emotion_confidence": 0.0,
#                 "nervousness_indicators": [],
#                 "issues": [],
#                 "warnings": []
#             }
            
#             if results.multi_face_landmarks:
#                 self.frame_count += 1
#                 analysis["face_detected"] = True
#                 face_landmarks = results.multi_face_landmarks[0]
                
#                 # Extract key landmarks
#                 landmarks = self._extract_landmarks(face_landmarks, image.shape)
                
#                 # Analyze eye contact
#                 eye_contact_info = self._analyze_eye_contact(landmarks)
#                 analysis["eye_contact_score"] = eye_contact_info["score"]
#                 analysis["gaze_direction"] = eye_contact_info["direction"]
                
#                 # Analyze head position and pose
#                 head_pose = self._analyze_head_pose(landmarks)
#                 analysis["head_position"] = head_pose["position"]
#                 analysis["head_tilt_angle"] = head_pose["tilt_angle"]
                
#                 # Detect head movement
#                 if self.previous_landmarks is not None:
#                     movement = self._detect_head_movement(landmarks, self.previous_landmarks)
#                     analysis["head_movement"] = movement["type"]
#                     analysis["movement_intensity"] = movement["intensity"]
                
#                 # Analyze emotions with DeepFace (skip frames for performance)
#                 if self.frame_count % self.emotion_analysis_interval == 0:
#                     emotion_analysis = self._analyze_emotions(image)
#                     if emotion_analysis:
#                         analysis["emotions"] = emotion_analysis["emotions"]
#                         analysis["dominant_emotion"] = emotion_analysis["dominant_emotion"]
#                         analysis["emotion_confidence"] = emotion_analysis["confidence"]
                        
#                         # Add to history
#                         self.emotion_history.append(emotion_analysis)
#                         if len(self.emotion_history) > self.max_emotion_history:
#                             self.emotion_history.pop(0)
#                 else:
#                     # Use last emotion analysis
#                     if self.emotion_history:
#                         last_emotion = self.emotion_history[-1]
#                         analysis["emotions"] = last_emotion["emotions"]
#                         analysis["dominant_emotion"] = last_emotion["dominant_emotion"]
#                         analysis["emotion_confidence"] = last_emotion["confidence"]
                
#                 # Detect nervousness indicators
#                 nervousness = self._detect_nervousness(
#                     analysis["dominant_emotion"],
#                     analysis.get("movement_intensity", 0),
#                     self.emotion_history
#                 )
#                 analysis["nervousness_indicators"] = nervousness
                
#                 # Analyze engagement (combination of factors)
#                 engagement = self._calculate_engagement(
#                     eye_contact_info["score"],
#                     head_pose["position"],
#                     analysis.get("movement_intensity", 0),
#                     analysis["dominant_emotion"]
#                 )
#                 analysis["engagement_score"] = engagement
                
#                 # Detect issues and generate warnings
#                 issues, warnings = self._detect_issues(analysis)
#                 analysis["issues"] = issues
#                 analysis["warnings"] = warnings
                
#                 # Store current landmarks for next frame
#                 self.previous_landmarks = landmarks
                
#             else:
#                 analysis["issues"].append("no_face_detected")
#                 analysis["warnings"].append("Please ensure your face is visible in the camera")
            
#             return analysis
            
#         except Exception as e:
#             print(f"Error in video analysis: {e}")
#             return self._get_empty_result(f"Analysis error: {str(e)}")
    
#     def _analyze_emotions(self, image: np.ndarray) -> Dict[str, Any]:
#         """
#         Analyze emotions using DeepFace.
        
#         Args:
#             image: OpenCV image (BGR format)
        
#         Returns:
#             Dictionary with emotion analysis
#         """
#         try:
#             # DeepFace.analyze returns a list of results
#             result = DeepFace.analyze(
#                 img_path=image,
#                 actions=['emotion'],
#                 enforce_detection=False,
#                 detector_backend='opencv',  # Faster detector
#                 silent=True
#             )
            
#             if result and len(result) > 0:
#                 first_face = result[0] if isinstance(result, list) else result
                
#                 emotions = first_face.get('emotion', {})
#                 dominant_emotion = first_face.get('dominant_emotion', 'neutral')
                
#                 # Get confidence of dominant emotion
#                 confidence = emotions.get(dominant_emotion, 0.0)
                
#                 return {
#                     "emotions": emotions,
#                     "dominant_emotion": dominant_emotion,
#                     "confidence": round(confidence, 2)
#                 }
            
#             return None
            
#         except Exception as e:
#             print(f"Error in emotion analysis: {e}")
#             return None
    
#     def _detect_nervousness(
#         self,
#         dominant_emotion: str,
#         movement_intensity: int,
#         emotion_history: List[Dict]
#     ) -> List[str]:
#         """
#         Detect nervousness indicators from emotions and behavior.
        
#         Args:
#             dominant_emotion: Current dominant emotion
#             movement_intensity: Level of head movement
#             emotion_history: Recent emotion detections
        
#         Returns:
#             List of nervousness indicators
#         """
#         indicators = []
        
#         # Check for fear or surprise (nervousness emotions)
#         if dominant_emotion in ['fear', 'surprise']:
#             indicators.append("nervous_expression")
        
#         # Check for excessive movement
#         if movement_intensity >= 2:
#             indicators.append("fidgeting")
        
#         # Check for emotion instability (rapid changes)
#         if len(emotion_history) >= 5:
#             recent_emotions = [e['dominant_emotion'] for e in emotion_history[-5:]]
#             unique_emotions = len(set(recent_emotions))
            
#             if unique_emotions >= 4:  # Changed emotions 4+ times in 5 detections
#                 indicators.append("emotional_instability")
        
#         return indicators
    
#     def _extract_landmarks(self, face_landmarks, image_shape) -> Dict[str, tuple]:
#         """Extract key facial landmarks with pixel coordinates."""
#         h, w = image_shape[:2]
        
#         landmarks = {}
        
#         # Key landmark indices from MediaPipe Face Mesh
#         # Eyes
#         landmarks['left_eye_left'] = self._get_landmark_coords(face_landmarks, 33, w, h)
#         landmarks['left_eye_right'] = self._get_landmark_coords(face_landmarks, 133, w, h)
#         landmarks['left_eye_top'] = self._get_landmark_coords(face_landmarks, 159, w, h)
#         landmarks['left_eye_bottom'] = self._get_landmark_coords(face_landmarks, 145, w, h)
        
#         landmarks['right_eye_left'] = self._get_landmark_coords(face_landmarks, 362, w, h)
#         landmarks['right_eye_right'] = self._get_landmark_coords(face_landmarks, 263, w, h)
#         landmarks['right_eye_top'] = self._get_landmark_coords(face_landmarks, 386, w, h)
#         landmarks['right_eye_bottom'] = self._get_landmark_coords(face_landmarks, 374, w, h)
        
#         # Nose
#         landmarks['nose_tip'] = self._get_landmark_coords(face_landmarks, 1, w, h)
#         landmarks['nose_bridge'] = self._get_landmark_coords(face_landmarks, 6, w, h)
        
#         # Mouth
#         landmarks['mouth_left'] = self._get_landmark_coords(face_landmarks, 61, w, h)
#         landmarks['mouth_right'] = self._get_landmark_coords(face_landmarks, 291, w, h)
        
#         # Chin
#         landmarks['chin'] = self._get_landmark_coords(face_landmarks, 152, w, h)
        
#         # Face outline
#         landmarks['left_face'] = self._get_landmark_coords(face_landmarks, 234, w, h)
#         landmarks['right_face'] = self._get_landmark_coords(face_landmarks, 454, w, h)
        
#         return landmarks
    
#     def _get_landmark_coords(self, face_landmarks, index: int, w: int, h: int) -> tuple:
#         """Get pixel coordinates for a landmark."""
#         landmark = face_landmarks.landmark[index]
#         return (int(landmark.x * w), int(landmark.y * h), landmark.z)
    
#     def _analyze_eye_contact(self, landmarks: Dict[str, tuple]) -> Dict[str, Any]:
#         """
#         Analyze eye contact by estimating gaze direction.
#         """
#         # Get eye centers
#         left_eye_center = self._get_eye_center(
#             landmarks['left_eye_left'],
#             landmarks['left_eye_right'],
#             landmarks['left_eye_top'],
#             landmarks['left_eye_bottom']
#         )
        
#         right_eye_center = self._get_eye_center(
#             landmarks['right_eye_left'],
#             landmarks['right_eye_right'],
#             landmarks['right_eye_top'],
#             landmarks['right_eye_bottom']
#         )
        
#         # Get nose tip position
#         nose_x, nose_y, _ = landmarks['nose_tip']
        
#         # Calculate if eyes are aligned with camera (centered)
#         face_center_x = (landmarks['left_face'][0] + landmarks['right_face'][0]) / 2
#         face_width = landmarks['right_face'][0] - landmarks['left_face'][0]
        
#         # Normalized position of nose relative to face
#         nose_offset = abs(nose_x - face_center_x) / face_width if face_width > 0 else 0
        
#         # Score eye contact (0-100)
#         eye_contact_score = max(0, 100 - (nose_offset * 200))
        
#         # Determine gaze direction
#         if nose_offset < 0.1:
#             direction = "center"
#         elif nose_x < face_center_x:
#             direction = "left"
#         else:
#             direction = "right"
        
#         return {
#             "score": round(eye_contact_score, 2),
#             "direction": direction
#         }
    
#     def _get_eye_center(self, left, right, top, bottom) -> tuple:
#         """Calculate the center point of an eye."""
#         center_x = (left[0] + right[0]) / 2
#         center_y = (top[1] + bottom[1]) / 2
#         return (center_x, center_y)
    
#     def _analyze_head_pose(self, landmarks: Dict[str, tuple]) -> Dict[str, Any]:
#         """
#         Analyze head position and orientation.
#         """
#         nose_x, nose_y, _ = landmarks['nose_tip']
#         chin_x, chin_y, _ = landmarks['chin']
        
#         # Calculate face boundaries
#         left_face_x = landmarks['left_face'][0]
#         right_face_x = landmarks['right_face'][0]
#         face_center_x = (left_face_x + right_face_x) / 2
#         face_width = right_face_x - left_face_x
        
#         # Horizontal position (left/right turn)
#         horizontal_offset = (nose_x - face_center_x) / face_width if face_width > 0 else 0
        
#         # Vertical position (up/down)
#         vertical_offset = (nose_y - chin_y) / face_width if face_width > 0 else 0
        
#         # Determine position
#         position = "neutral"
        
#         if abs(horizontal_offset) > 0.15:
#             if horizontal_offset < 0:
#                 position = "turned_left"
#             else:
#                 position = "turned_right"
#         elif vertical_offset > 0.2:
#             position = "looking_down"
#         elif vertical_offset < -0.1:
#             position = "looking_up"
        
#         # Calculate tilt angle
#         mouth_left_y = landmarks['mouth_left'][1]
#         mouth_right_y = landmarks['mouth_right'][1]
#         tilt_angle = np.degrees(np.arctan2(
#             mouth_right_y - mouth_left_y,
#             landmarks['mouth_right'][0] - landmarks['mouth_left'][0]
#         ))
        
#         return {
#             "position": position,
#             "tilt_angle": round(tilt_angle, 2),
#             "horizontal_offset": round(horizontal_offset, 3),
#             "vertical_offset": round(vertical_offset, 3)
#         }
    
#     def _detect_head_movement(self, current: Dict, previous: Dict) -> Dict[str, Any]:
#         """
#         Detect head movement between frames.
#         """
#         # Compare nose positions
#         curr_nose = current['nose_tip']
#         prev_nose = previous['nose_tip']
        
#         # Calculate movement distance
#         distance = np.sqrt(
#             (curr_nose[0] - prev_nose[0])**2 + 
#             (curr_nose[1] - prev_nose[1])**2
#         )
        
#         # Classify movement
#         if distance < 5:
#             movement_type = "stable"
#             intensity = 0
#         elif distance < 15:
#             movement_type = "slight"
#             intensity = 1
#         elif distance < 30:
#             movement_type = "moderate"
#             intensity = 2
#         else:
#             movement_type = "excessive"
#             intensity = 3
        
#         return {
#             "type": movement_type,
#             "intensity": intensity,
#             "distance": round(distance, 2)
#         }
    
#     def _calculate_engagement(
#         self, 
#         eye_contact_score: float, 
#         head_position: str,
#         movement_intensity: int,
#         emotion: str
#     ) -> float:
#         """
#         Calculate overall engagement score.
#         """
#         score = eye_contact_score  # Start with eye contact (0-100)
        
#         # Penalty for poor head position
#         if head_position in ["looking_down", "looking_up"]:
#             score -= 30
#         elif head_position in ["turned_left", "turned_right"]:
#             score -= 20
        
#         # Penalty for excessive movement
#         if movement_intensity == 3:
#             score -= 20
#         elif movement_intensity == 2:
#             score -= 10
        
#         # Bonus for positive emotions
#         if emotion in ["happy", "neutral"]:
#             score += 10
#         elif emotion in ["sad", "fear", "angry"]:
#             score -= 15
        
#         return max(0, min(100, round(score, 2)))
    
#     def _detect_issues(self, analysis: Dict[str, Any]) -> tuple:
#         """
#         Detect issues and generate real-time warnings.
#         """
#         issues = []
#         warnings = []
        
#         # Check eye contact
#         if analysis["eye_contact_score"] < 30:
#             issues.append("poor_eye_contact")
#             warnings.append("Try to look directly at the camera to maintain eye contact")
        
#         # Check head position
#         if analysis["head_position"] == "looking_down":
#             issues.append("looking_down")
#             warnings.append("Keep your head up and look at the camera")
#         elif analysis["head_position"] == "looking_up":
#             issues.append("looking_up")
#             warnings.append("Lower your gaze to the camera level")
#         elif analysis["head_position"] in ["turned_left", "turned_right"]:
#             issues.append("head_turned")
#             warnings.append("Face the camera directly")
        
#         # Check movement
#         if analysis.get("movement_intensity", 0) >= 2:
#             issues.append("excessive_movement")
#             warnings.append("Try to keep your head steady - excessive movement can show nervousness")
        
#         # Check engagement
#         if analysis["engagement_score"] < 50:
#             issues.append("low_engagement")
#             warnings.append("You seem distracted - try to stay focused on the interview")
        
#         # Check emotions for nervousness
#         emotion = analysis.get("dominant_emotion", "neutral")
#         if emotion in ["fear", "surprise"]:
#             issues.append("nervous")
#             warnings.append("Take a deep breath - you're doing fine!")
#         elif emotion == "sad":
#             issues.append("low_energy")
#             warnings.append("Try to project more positive energy")
        
#         # Check nervousness indicators
#         if len(analysis.get("nervousness_indicators", [])) >= 2:
#             issues.append("showing_nervousness")
#             warnings.append("You seem nervous - remember to breathe and take your time")
        
#         return issues, warnings
    
#     def _get_empty_result(self, error_msg: str = "") -> Dict[str, Any]:
#         """Return empty result structure when analysis fails."""
#         return {
#             "timestamp": datetime.utcnow().isoformat(),
#             "face_detected": False,
#             "eye_contact_score": 0.0,
#             "head_position": "unknown",
#             "engagement_score": 0.0,
#             "emotions": {},
#             "dominant_emotion": "neutral",
#             "issues": ["analysis_failed"],
#             "warnings": [error_msg] if error_msg else [],
#             "error": error_msg
#         }
    
#     def reset(self):
#         """Reset analyzer state for new session."""
#         self.previous_landmarks = None
#         self.frame_count = 0
#         self.emotion_history = []

import cv2
import mediapipe as mp
import numpy as np
from typing import Dict, Any, List, Optional
import base64
from datetime import datetime

# Try to import DeepFace, but make it optional
DEEPFACE_AVAILABLE = False
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
    print("✓ DeepFace loaded successfully")
except ImportError:
    print("⚠ DeepFace not available - emotion analysis will be disabled")
except Exception as e:
    print(f"⚠ DeepFace initialization error: {e}")

class VideoAnalyzer:
    """
    Analyzes video frames for facial features, emotions, eye contact, and non-verbal cues.
    Uses MediaPipe (free) for face landmarks and DeepFace for emotion recognition.
    """
    
    def __init__(self):
        # Initialize MediaPipe Face Mesh
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Track previous frames for motion detection
        self.previous_landmarks = None
        self.frame_count = 0
        self.frame_skip_counter = 0
        self.frame_skip_rate = 2  # Process every 2nd frame for performance

        
        # Track emotions over time
        self.emotion_history = []
        self.max_emotion_history = 30
        
        # Frame skip for DeepFace (it's slower)
        self.emotion_analysis_interval = 5
        
        # Flag for DeepFace availability
        self.deepface_available = DEEPFACE_AVAILABLE
        
    def analyze_frame(self, frame_data: str) -> Dict[str, Any]:
        self.frame_skip_counter += 1
        if self.frame_skip_counter % self.frame_skip_rate != 0:
            # Return last analysis
            if hasattr(self, 'last_analysis'):
                return self.last_analysis
        """
        Analyze a single video frame for facial features, emotions, and behavior.
        
        Args:
            frame_data: Base64 encoded image string
        
        Returns:
            Dictionary containing analysis results
        """
        try:
            # Decode base64 image
            if ',' in frame_data:
                frame_data = frame_data.split(',')[1]
            
            img_data = base64.b64decode(frame_data)
            nparr = np.frombuffer(img_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                return self._get_empty_result("Invalid image data")
            
            # Convert BGR to RGB for MediaPipe
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe Face Mesh
            results = self.face_mesh.process(rgb_image)
            
            analysis = {
                "timestamp": datetime.utcnow().isoformat(),
                "face_detected": False,
                "eye_contact_score": 0.0,
                "head_position": "unknown",
                "head_movement": "stable",
                "engagement_score": 0.0,
                "emotions": {},
                "dominant_emotion": "neutral",
                "emotion_confidence": 0.0,
                "nervousness_indicators": [],
                "issues": [],
                "warnings": []
            }
            
            if results.multi_face_landmarks:
                self.frame_count += 1
                analysis["face_detected"] = True
                face_landmarks = results.multi_face_landmarks[0]
                
                # Extract key landmarks
                landmarks = self._extract_landmarks(face_landmarks, image.shape)
                
                # Analyze eye contact
                eye_contact_info = self._analyze_eye_contact(landmarks)
                analysis["eye_contact_score"] = eye_contact_info["score"]
                analysis["gaze_direction"] = eye_contact_info["direction"]
                
                # Analyze head position and pose
                head_pose = self._analyze_head_pose(landmarks)
                analysis["head_position"] = head_pose["position"]
                analysis["head_tilt_angle"] = head_pose["tilt_angle"]
                
                # Detect head movement
                if self.previous_landmarks is not None:
                    movement = self._detect_head_movement(landmarks, self.previous_landmarks)
                    analysis["head_movement"] = movement["type"]
                    analysis["movement_intensity"] = movement["intensity"]
                
                # Analyze emotions with DeepFace (skip frames for performance)
                if self.deepface_available and self.frame_count % self.emotion_analysis_interval == 0:
                    emotion_analysis = self._analyze_emotions(image)
                    if emotion_analysis:
                        analysis["emotions"] = emotion_analysis["emotions"]
                        analysis["dominant_emotion"] = emotion_analysis["dominant_emotion"]
                        analysis["emotion_confidence"] = emotion_analysis["confidence"]
                        
                        # Add to history
                        self.emotion_history.append(emotion_analysis)
                        if len(self.emotion_history) > self.max_emotion_history:
                            self.emotion_history.pop(0)
                else:
                    # Use last emotion analysis or default to neutral
                    if self.emotion_history:
                        last_emotion = self.emotion_history[-1]
                        analysis["emotions"] = last_emotion["emotions"]
                        analysis["dominant_emotion"] = last_emotion["dominant_emotion"]
                        analysis["emotion_confidence"] = last_emotion["confidence"]
                    else:
                        analysis["dominant_emotion"] = "neutral"
                        analysis["emotions"] = {"neutral": 100}
                
                # Detect nervousness indicators
                nervousness = self._detect_nervousness(
                    analysis["dominant_emotion"],
                    analysis.get("movement_intensity", 0),
                    self.emotion_history
                )
                analysis["nervousness_indicators"] = nervousness
                
                # Analyze engagement (combination of factors)
                engagement = self._calculate_engagement(
                    eye_contact_info["score"],
                    head_pose["position"],
                    analysis.get("movement_intensity", 0),
                    analysis["dominant_emotion"]
                )
                analysis["engagement_score"] = engagement
                
                # Detect issues and generate warnings
                issues, warnings = self._detect_issues(analysis)
                analysis["issues"] = issues
                analysis["warnings"] = warnings
                
                # Store current landmarks for next frame
                self.previous_landmarks = landmarks
                
            else:
                analysis["issues"].append("no_face_detected")
                analysis["warnings"].append("Please ensure your face is visible in the camera")
                
            self.last_analysis = analysis
            return analysis
            
        except Exception as e:
            print(f"Error in video analysis: {e}")
            import traceback
            traceback.print_exc()
            return self._get_empty_result(f"Analysis error: {str(e)}")
    
    def _analyze_emotions(self, image: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Analyze emotions using DeepFace.
        
        Args:
            image: OpenCV image (BGR format)
        
        Returns:
            Dictionary with emotion analysis or None if failed
        """
        if not self.deepface_available:
            return None
            
        try:
            # DeepFace.analyze returns a list of results
            result = DeepFace.analyze(
                img_path=image,
                actions=['emotion'],
                enforce_detection=False,
                detector_backend='opencv',  # Faster detector
                silent=True
            )
            
            if result and len(result) > 0:
                first_face = result[0] if isinstance(result, list) else result
                
                emotions = first_face.get('emotion', {})
                dominant_emotion = first_face.get('dominant_emotion', 'neutral')
                
                # Get confidence of dominant emotion
                confidence = emotions.get(dominant_emotion, 0.0)
                
                return {
                    "emotions": emotions,
                    "dominant_emotion": dominant_emotion,
                    "confidence": round(confidence, 2)
                }
            
            return None
            
        except Exception as e:
            print(f"Error in emotion analysis: {e}")
            return None
    
    def _detect_nervousness(
        self,
        dominant_emotion: str,
        movement_intensity: int,
        emotion_history: List[Dict]
    ) -> List[str]:
        """
        Detect nervousness indicators from emotions and behavior.
        """
        indicators = []
        
        # Check for fear or surprise (nervousness emotions)
        if dominant_emotion in ['fear', 'surprise']:
            indicators.append("nervous_expression")
        
        # Check for excessive movement
        if movement_intensity >= 2:
            indicators.append("fidgeting")
        
        # Check for emotion instability (rapid changes)
        if len(emotion_history) >= 5:
            recent_emotions = [e['dominant_emotion'] for e in emotion_history[-5:]]
            unique_emotions = len(set(recent_emotions))
            
            if unique_emotions >= 4:
                indicators.append("emotional_instability")
        
        return indicators
    
    def _extract_landmarks(self, face_landmarks, image_shape) -> Dict[str, tuple]:
        """Extract key facial landmarks with pixel coordinates."""
        h, w = image_shape[:2]
        
        landmarks = {}
        
        # Key landmark indices from MediaPipe Face Mesh
        # Eyes
        landmarks['left_eye_left'] = self._get_landmark_coords(face_landmarks, 33, w, h)
        landmarks['left_eye_right'] = self._get_landmark_coords(face_landmarks, 133, w, h)
        landmarks['left_eye_top'] = self._get_landmark_coords(face_landmarks, 159, w, h)
        landmarks['left_eye_bottom'] = self._get_landmark_coords(face_landmarks, 145, w, h)
        
        landmarks['right_eye_left'] = self._get_landmark_coords(face_landmarks, 362, w, h)
        landmarks['right_eye_right'] = self._get_landmark_coords(face_landmarks, 263, w, h)
        landmarks['right_eye_top'] = self._get_landmark_coords(face_landmarks, 386, w, h)
        landmarks['right_eye_bottom'] = self._get_landmark_coords(face_landmarks, 374, w, h)
        
        # Nose
        landmarks['nose_tip'] = self._get_landmark_coords(face_landmarks, 1, w, h)
        landmarks['nose_bridge'] = self._get_landmark_coords(face_landmarks, 6, w, h)
        
        # Mouth
        landmarks['mouth_left'] = self._get_landmark_coords(face_landmarks, 61, w, h)
        landmarks['mouth_right'] = self._get_landmark_coords(face_landmarks, 291, w, h)
        
        # Chin
        landmarks['chin'] = self._get_landmark_coords(face_landmarks, 152, w, h)
        
        # Face outline
        landmarks['left_face'] = self._get_landmark_coords(face_landmarks, 234, w, h)
        landmarks['right_face'] = self._get_landmark_coords(face_landmarks, 454, w, h)
        
        return landmarks
    
    def _get_landmark_coords(self, face_landmarks, index: int, w: int, h: int) -> tuple:
        """Get pixel coordinates for a landmark."""
        landmark = face_landmarks.landmark[index]
        return (int(landmark.x * w), int(landmark.y * h), landmark.z)
    
    def _analyze_eye_contact(self, landmarks: Dict[str, tuple]) -> Dict[str, Any]:
        """Analyze eye contact by estimating gaze direction."""
        left_eye_center = self._get_eye_center(
            landmarks['left_eye_left'],
            landmarks['left_eye_right'],
            landmarks['left_eye_top'],
            landmarks['left_eye_bottom']
        )
        
        right_eye_center = self._get_eye_center(
            landmarks['right_eye_left'],
            landmarks['right_eye_right'],
            landmarks['right_eye_top'],
            landmarks['right_eye_bottom']
        )
        
        nose_x, nose_y, _ = landmarks['nose_tip']
        
        face_center_x = (landmarks['left_face'][0] + landmarks['right_face'][0]) / 2
        face_width = landmarks['right_face'][0] - landmarks['left_face'][0]
        
        nose_offset = abs(nose_x - face_center_x) / face_width if face_width > 0 else 0
        
        eye_contact_score = max(0, 100 - (nose_offset * 200))
        
        if nose_offset < 0.1:
            direction = "center"
        elif nose_x < face_center_x:
            direction = "left"
        else:
            direction = "right"
        
        return {
            "score": round(eye_contact_score, 2),
            "direction": direction
        }
    
    def _get_eye_center(self, left, right, top, bottom) -> tuple:
        """Calculate the center point of an eye."""
        center_x = (left[0] + right[0]) / 2
        center_y = (top[1] + bottom[1]) / 2
        return (center_x, center_y)
    
    def _analyze_head_pose(self, landmarks: Dict[str, tuple]) -> Dict[str, Any]:
        """Analyze head position and orientation."""
        nose_x, nose_y, _ = landmarks['nose_tip']
        chin_x, chin_y, _ = landmarks['chin']
        
        left_face_x = landmarks['left_face'][0]
        right_face_x = landmarks['right_face'][0]
        face_center_x = (left_face_x + right_face_x) / 2
        face_width = right_face_x - left_face_x
        
        horizontal_offset = (nose_x - face_center_x) / face_width if face_width > 0 else 0
        vertical_offset = (nose_y - chin_y) / face_width if face_width > 0 else 0
        
        position = "neutral"
        
        if abs(horizontal_offset) > 0.15:
            if horizontal_offset < 0:
                position = "turned_left"
            else:
                position = "turned_right"
        elif vertical_offset > 0.2:
            position = "looking_down"
        elif vertical_offset < -0.1:
            position = "looking_up"
        
        mouth_left_y = landmarks['mouth_left'][1]
        mouth_right_y = landmarks['mouth_right'][1]
        tilt_angle = np.degrees(np.arctan2(
            mouth_right_y - mouth_left_y,
            landmarks['mouth_right'][0] - landmarks['mouth_left'][0]
        ))
        
        return {
            "position": position,
            "tilt_angle": round(tilt_angle, 2),
            "horizontal_offset": round(horizontal_offset, 3),
            "vertical_offset": round(vertical_offset, 3)
        }
    
    def _detect_head_movement(self, current: Dict, previous: Dict) -> Dict[str, Any]:
        """Detect head movement between frames."""
        curr_nose = current['nose_tip']
        prev_nose = previous['nose_tip']
        
        distance = np.sqrt(
            (curr_nose[0] - prev_nose[0])**2 + 
            (curr_nose[1] - prev_nose[1])**2
        )
        
        if distance < 5:
            movement_type = "stable"
            intensity = 0
        elif distance < 15:
            movement_type = "slight"
            intensity = 1
        elif distance < 30:
            movement_type = "moderate"
            intensity = 2
        else:
            movement_type = "excessive"
            intensity = 3
        
        return {
            "type": movement_type,
            "intensity": intensity,
            "distance": round(distance, 2)
        }
    
    def _calculate_engagement(
        self, 
        eye_contact_score: float, 
        head_position: str,
        movement_intensity: int,
        emotion: str
    ) -> float:
        """Calculate overall engagement score."""
        score = eye_contact_score
        
        if head_position in ["looking_down", "looking_up"]:
            score -= 30
        elif head_position in ["turned_left", "turned_right"]:
            score -= 20
        
        if movement_intensity == 3:
            score -= 20
        elif movement_intensity == 2:
            score -= 10
        
        if emotion in ["happy", "neutral"]:
            score += 10
        elif emotion in ["sad", "fear", "angry"]:
            score -= 15
        
        return max(0, min(100, round(score, 2)))
    
    def _detect_issues(self, analysis: Dict[str, Any]) -> tuple:
        """Detect issues and generate real-time warnings."""
        issues = []
        warnings = []
        
        if analysis["eye_contact_score"] < 30:
            issues.append("poor_eye_contact")
            warnings.append("Try to look directly at the camera to maintain eye contact")
        
        if analysis["head_position"] == "looking_down":
            issues.append("looking_down")
            warnings.append("Keep your head up and look at the camera")
        elif analysis["head_position"] == "looking_up":
            issues.append("looking_up")
            warnings.append("Lower your gaze to the camera level")
        elif analysis["head_position"] in ["turned_left", "turned_right"]:
            issues.append("head_turned")
            warnings.append("Face the camera directly")
        
        if analysis.get("movement_intensity", 0) >= 2:
            issues.append("excessive_movement")
            warnings.append("Try to keep your head steady - excessive movement can show nervousness")
        
        if analysis["engagement_score"] < 50:
            issues.append("low_engagement")
            warnings.append("You seem distracted - try to stay focused on the interview")
        
        emotion = analysis.get("dominant_emotion", "neutral")
        if emotion in ["fear", "surprise"]:
            issues.append("nervous")
            warnings.append("Take a deep breath - you're doing fine!")
        elif emotion == "sad":
            issues.append("low_energy")
            warnings.append("Try to project more positive energy")
        
        if len(analysis.get("nervousness_indicators", [])) >= 2:
            issues.append("showing_nervousness")
            warnings.append("You seem nervous - remember to breathe and take your time")
        
        return issues, warnings
    
    def _get_empty_result(self, error_msg: str = "") -> Dict[str, Any]:
        """Return empty result structure when analysis fails."""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "face_detected": False,
            "eye_contact_score": 0.0,
            "head_position": "unknown",
            "engagement_score": 0.0,
            "emotions": {},
            "dominant_emotion": "neutral",
            "issues": ["analysis_failed"],
            "warnings": [error_msg] if error_msg else [],
            "error": error_msg
        }
    
    def reset(self):
        """Reset analyzer state for new session."""
        self.previous_landmarks = None
        self.frame_count = 0
        self.emotion_history = []