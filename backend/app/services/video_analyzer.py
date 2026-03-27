"""
VideoAnalyzer — Production service for AI Communication Interview Helper
========================================================================
Model stack:
  • Face detection + landmarks : MediaPipe FaceMesh (Google, Apache 2.0)
  • Eye contact / head pose     : Custom geometry on MediaPipe landmarks
  • Emotion recognition         : HSEmotion EfficientNet-B2
                                  Savchenko A.V., IEEE Trans. Affective Computing, 2022
                                  Trained on AffectNet (450k images, 8 classes, ~75% accuracy)
                                  Runs via ONNX Runtime — no TF/Keras version conflict

Input  : base64-encoded JPEG frame string (from WebSocket video_frame messages)
Output : Dict with all metrics, warnings, issues — compatible with:
           • real_time_monitor.py  (per-frame warnings → WebSocket interventions)
           • feedback_generator.py (session summary → final feedback report)
           • Frontend WebSocket    (live overlay warnings on camera)

Install (add to backend/requirements.txt):
  mediapipe==0.10.21
  opencv-python-headless==4.8.1.78
  numpy>=1.26,<1.27
  hsemotion-onnx
"""

import cv2
import mediapipe as mp
import numpy as np
import base64
from typing import Dict, Any, List, Optional
from datetime import datetime

# ─────────────────────────── HSEmotion (ONNX) ────────────────────────────────
# EfficientNet-B2 trained on AffectNet — 8-class emotion recognition
# ~75% accuracy on AffectNet vs DeepFace's ~64% on same benchmark
# ONNX runtime: framework-agnostic, ~15ms CPU inference, no Keras dependency
EMOTION_AVAILABLE = False
_emotion_model    = None

EMOTION_LABELS = [
    'anger', 'contempt', 'disgust', 'fear',
    'happy', 'neutral',  'sad',     'surprise'
]

try:
    from hsemotion_onnx.facial_emotions import HSEmotionRecognizer
    _emotion_model    = HSEmotionRecognizer(model_name='enet_b2_8')
    EMOTION_AVAILABLE = True
    print("✓ VideoAnalyzer: HSEmotion (EfficientNet-B2 / AffectNet) loaded")
except Exception as e:
    print(f"⚠  VideoAnalyzer: HSEmotion not available ({e})")
    print("   pip install hsemotion-onnx")


# ─────────────────────────── Head pose thresholds ────────────────────────────
# Calibrated for typical laptop webcam (camera positioned below eye level)
HEAD_HORIZ_THRESH     = 0.13   # left/right turn sensitivity
HEAD_VERT_DOWN_THRESH = 0.48   # v_off > -this  → looking_down
HEAD_VERT_UP_THRESH   = 0.59   # v_off < -this  → looking_up

# Eye Aspect Ratio threshold — below this = eyes closed
EAR_CLOSED_THRESH = 0.15

# Emotion analysis frame interval (every Nth processed frame)
EMOTION_FRAME_INTERVAL = 1


# ─────────────────────────── VideoAnalyzer ───────────────────────────────────
class VideoAnalyzer:
    """
    Analyzes base64-encoded video frames for:
      - Face detection
      - Eye contact score (0-100)
      - Eye Aspect Ratio (blink / eye closure detection)
      - Gaze direction (center / left / right / closed)
      - Head position (neutral / looking_down / looking_up /
                       turned_left / turned_right)
      - Head tilt angle (degrees)
      - Head movement intensity (stable / slight / moderate / excessive)
      - Emotion (8-class: anger, contempt, disgust, fear,
                          happy, neutral, sad, surprise)
      - Emotion confidence (%)
      - Engagement score (0-100, composite)
      - Nervousness indicators
      - Real-time issues list
      - Real-time warnings list (shown on frontend camera overlay)

    All results are stored per-frame and accumulated for session summary,
    which is consumed by feedback_generator.py at session end.
    """

    def __init__(self):
        # MediaPipe FaceMesh
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh    = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        # State tracking
        self.previous_landmarks  = None
        self.frame_count         = 0      # processed frames (after skip)
        self.skip_counter        = 0
        self.frame_skip_rate     = 2      # process every 2nd frame
        
        # In __init__, add:
        self._consecutive_issues: Dict[str, int] = {}
        # ADD:
        self._warning_thresholds = {
            "looking_down":       2,   # fast — 2 frames
            "looking_up":         2,   # fast
            "head_turned_left":   1,   # instant
            "head_turned_right":  1,   # instant
            "eyes_closed":        1,   # instant
            "poor_eye_contact":   5,   # slower — avoid false positives
            "excessive_movement": 3,
            "low_engagement":     8,   # slow — needs sustained distraction
            "nervous":            6,
            "low_energy":         6,
            "negative_expression":6,
            "showing_nervousness":6,
        }

        # Emotion history (kept for nervousness detection + session summary)
        self.emotion_history: List[Dict] = []
        self.max_emotion_history = 30
        self.last_emo: Dict = {
            "dominant_emotion":   "neutral",
            "emotion_confidence": 0.0,
            "emotions":           {e: 0.0 for e in EMOTION_LABELS},
        }

        # Per-session accumulators for feedback_generator
        self._eye_contact_samples:  List[float] = []
        self._engagement_samples:   List[float] = []
        self._head_position_counts: Dict[str, int] = {
            "neutral": 0, "looking_down": 0, "looking_up": 0,
            "turned_left": 0, "turned_right": 0
        }
        self._emotion_counts:   Dict[str, int] = {e: 0 for e in EMOTION_LABELS}
        self._nervousness_hits: int = 0
        self._issue_counts:     Dict[str, int] = {}

        # Keep last result for frame-skip returns
        self._last_analysis: Optional[Dict] = None

        self.deepface_available  = False   # kept for API compat — we use HSEmotion
        self.emotion_model_name  = "HSEmotion EfficientNet-B2 (AffectNet)"

    # ─────────────────────────── Public API ──────────────────────────────────

    def analyze_frame(self, frame_data: str) -> Dict[str, Any]:
        """
        Analyze a single base64-encoded video frame.

        Args:
            frame_data: Base64 string (with or without data:image/...;base64, prefix)

        Returns:
            Dict with all metrics. Compatible with real_time_monitor.py and
            feedback_generator.py. Also contains 'warnings' list for
            live frontend overlay.
        """
        # Frame skip for performance
        self.skip_counter += 1
        if self.skip_counter % self.frame_skip_rate != 0:
            return self._last_analysis if self._last_analysis else self._empty_result()

        try:
            # Decode base64 → OpenCV BGR frame
            image = self._decode_frame(frame_data)
            if image is None:
                return self._empty_result("Failed to decode frame")

            h, w = image.shape[:2]
            rgb  = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # MediaPipe inference
            results = self.face_mesh.process(rgb)

            analysis = self._empty_result()

            if results.multi_face_landmarks:
                self.frame_count += 1
                face_lm = results.multi_face_landmarks[0]
                lm      = self._extract_landmarks(face_lm, image.shape)

                analysis["face_detected"] = True

                # ── Eye contact + EAR ─────────────────────────────────────────
                eye = self._analyze_eye_contact(lm)
                analysis["eye_contact_score"] = eye["score"]
                analysis["gaze_direction"]    = eye["direction"]
                analysis["eye_aspect_ratio"]  = eye["ear"]

                # ── Head pose ─────────────────────────────────────────────────
                pose = self._analyze_head_pose(lm)
                analysis["head_position"]         = pose["position"]
                analysis["head_tilt_angle"]       = pose["tilt_angle"]
                analysis["head_horizontal_offset"]= pose["horizontal_offset"]
                analysis["head_vertical_offset"]  = pose["vertical_offset"]

                # ── Head movement ─────────────────────────────────────────────
                if self.previous_landmarks:
                    mv = self._detect_head_movement(lm, self.previous_landmarks)
                    analysis["head_movement"]      = mv["type"]
                    analysis["movement_intensity"] = mv["intensity"]
                    analysis["movement_distance"]  = mv["distance"]

                # ── Emotion (HSEmotion ONNX) ──────────────────────────────────
                if EMOTION_AVAILABLE and self.frame_count % EMOTION_FRAME_INTERVAL == 0:
                    # Get bounding box for face crop
                    xs  = [lm[k][0] for k in lm]
                    ys  = [lm[k][1] for k in lm]
                    x1  = max(0, min(xs) - 15)
                    y1  = max(0, min(ys) - 20)
                    x2  = min(w, max(xs) + 15)
                    y2  = min(h, max(ys) + 15)
                    emo = self._analyze_emotions(image, x1, y1, x2, y2)
                    if emo:
                        self.last_emo = emo
                        self.emotion_history.append(emo)
                        if len(self.emotion_history) > self.max_emotion_history:
                            self.emotion_history.pop(0)
                        # Accumulate for session summary
                        dom = emo["dominant_emotion"]
                        if dom in self._emotion_counts:
                            self._emotion_counts[dom] += 1

                analysis["emotions"]           = self.last_emo["emotions"]
                analysis["dominant_emotion"]   = self.last_emo["dominant_emotion"]
                analysis["emotion_confidence"] = self.last_emo["emotion_confidence"]

                # ── Nervousness ───────────────────────────────────────────────
                nervousness = self._detect_nervousness(
                    analysis["dominant_emotion"],
                    analysis.get("movement_intensity", 0),
                    self.emotion_history,
                )
                analysis["nervousness_indicators"] = nervousness
                if nervousness:
                    self._nervousness_hits += 1

                # ── Engagement ────────────────────────────────────────────────
                engagement = self._calculate_engagement(
                    analysis["eye_contact_score"],
                    analysis["head_position"],
                    analysis.get("movement_intensity", 0),
                    analysis["dominant_emotion"],
                )
                analysis["engagement_score"] = engagement

                # ── Issues + warnings (for frontend overlay + real_time_monitor)
                issues, warnings = self._detect_issues(analysis)
                analysis["issues"]   = issues
                analysis["warnings"] = warnings

                # ── Accumulate per-session stats ──────────────────────────────
                self._eye_contact_samples.append(analysis["eye_contact_score"])
                self._engagement_samples.append(analysis["engagement_score"])
                pos = analysis["head_position"]
                if pos in self._head_position_counts:
                    self._head_position_counts[pos] += 1
                for issue in issues:
                    self._issue_counts[issue] = self._issue_counts.get(issue, 0) + 1

                self.previous_landmarks = lm

            else:
                analysis["issues"].append("no_face_detected")
                analysis["warnings"].append(
                    "Please ensure your face is visible in the camera")

            self._last_analysis = analysis
            return analysis

        except Exception as e:
            print(f"[VideoAnalyzer] Error: {e}")
            import traceback
            traceback.print_exc()
            return self._empty_result(f"Analysis error: {str(e)}")

    def get_session_summary(self) -> Dict[str, Any]:
        """
        Return aggregated metrics for the entire session.
        Called by real_time_monitor.get_session_summary() which feeds
        feedback_generator._calculate_aggregate_scores().

        Returns dict keys matching what feedback_generator expects:
          eye_contact_score, engagement_score, dominant_emotion,
          emotion_breakdown, nervousness_rate, head_position_breakdown,
          issue_counts, frames_analyzed
        """
        total = max(len(self._eye_contact_samples), 1)

        avg_eye     = (sum(self._eye_contact_samples) / total
                       if self._eye_contact_samples else 0.0)
        avg_engage  = (sum(self._engagement_samples) / total
                       if self._engagement_samples else 0.0)

        # Most frequent emotion across the session
        dominant_emo = max(self._emotion_counts, key=self._emotion_counts.get) \
                       if any(self._emotion_counts.values()) else "neutral"

        nervousness_rate = round(self._nervousness_hits / total * 100, 1)

        return {
            # Keys consumed by feedback_generator
            "eye_contact_score":       round(avg_eye, 2),
            "engagement_score":        round(avg_engage, 2),
            "dominant_emotion":        dominant_emo,
            "emotion_breakdown":       dict(self._emotion_counts),
            "nervousness_rate":        nervousness_rate,
            "head_position_breakdown": dict(self._head_position_counts),
            "issue_counts":            dict(self._issue_counts),
            "frames_analyzed":         self.frame_count,
            "emotion_model":           self.emotion_model_name,
        }

    def reset(self):
        """Reset state for a new question / new session."""
        self.previous_landmarks  = None
        self.frame_count         = 0
        self.skip_counter        = 0
        self.emotion_history     = []
        self.last_emo            = {
            "dominant_emotion":   "neutral",
            "emotion_confidence": 0.0,
            "emotions":           {e: 0.0 for e in EMOTION_LABELS},
        }
        self._eye_contact_samples  = []
        self._engagement_samples   = []
        self._head_position_counts = {k: 0 for k in self._head_position_counts}
        self._emotion_counts       = {e: 0 for e in EMOTION_LABELS}
        self._nervousness_hits     = 0
        self._issue_counts         = {}
        self._last_analysis        = None
        self._consecutive_issues = {}

    # ─────────────────────────── Private helpers ─────────────────────────────

    def _decode_frame(self, frame_data: str) -> Optional[np.ndarray]:
        """Decode base64 string to BGR OpenCV image."""
        try:
            if "," in frame_data:
                frame_data = frame_data.split(",")[1]
            img_bytes = base64.b64decode(frame_data)
            nparr     = np.frombuffer(img_bytes, np.uint8)
            image     = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return image
        except Exception as e:
            print(f"[VideoAnalyzer] Decode error: {e}")
            return None

    def _extract_landmarks(self, face_lm, image_shape) -> Dict[str, tuple]:
        """Extract key facial landmarks as (x_px, y_px, z) tuples."""
        h, w = image_shape[:2]
        def g(i):
            p = face_lm.landmark[i]
            return (int(p.x * w), int(p.y * h), p.z)
        return {
            "left_eye_left":    g(33),  "left_eye_right":   g(133),
            "left_eye_top":     g(159), "left_eye_bottom":  g(145),
            "right_eye_left":   g(362), "right_eye_right":  g(263),
            "right_eye_top":    g(386), "right_eye_bottom": g(374),
            "nose_tip":         g(1),   "nose_bridge":      g(6),
            "mouth_left":       g(61),  "mouth_right":      g(291),
            "chin":             g(152),
            "left_face":        g(234), "right_face":       g(454),
        }

    def _ear(self, lm: Dict) -> float:
        """Eye Aspect Ratio — approaches 0 when eyes are closed."""
        def one(top, bot, left, right):
            v = abs(top[1] - bot[1])
            h = abs(left[0] - right[0])
            return v / h if h else 0.0
        l = one(lm["left_eye_top"],  lm["left_eye_bottom"],
                lm["left_eye_left"], lm["left_eye_right"])
        r = one(lm["right_eye_top"], lm["right_eye_bottom"],
                lm["right_eye_left"],lm["right_eye_right"])
        return (l + r) / 2

    def _analyze_eye_contact(self, lm: Dict) -> Dict[str, Any]:
        """
        Compute eye contact score (0-100) from nose-face-center offset.
        Penalises to 0 when eyes are detected as closed (EAR < threshold).
        """
        nx   = lm["nose_tip"][0]
        cx   = (lm["left_face"][0] + lm["right_face"][0]) / 2
        fw   = lm["right_face"][0] - lm["left_face"][0]
        off  = abs(nx - cx) / fw if fw else 0
        gaze_score = max(0.0, 100.0 - off * 200.0)
        dir_ = "center" if off < 0.1 else ("left" if nx < cx else "right")

        ear   = self._ear(lm)
        if ear < EAR_CLOSED_THRESH:
            score = 0.0
            dir_  = "closed"
        else:
            score = gaze_score

        return {
            "score":     round(score, 1),
            "direction": dir_,
            "ear":       round(ear, 3),
        }

    def _analyze_head_pose(self, lm: Dict) -> Dict[str, Any]:
        """
        Compute head position from nose-chin-face geometry.

        v_off = (nose_y - chin_y) / face_width
        Chin is below nose in pixel coords (chin_y > nose_y)
        → v_off is normally negative
        → looking_down : nose moves toward chin → v_off closer to 0
        → looking_up   : nose moves far above chin → v_off very negative
        """
        nx, ny, _ = lm["nose_tip"]
        cy        = lm["chin"][1]
        lx        = lm["left_face"][0]
        rx        = lm["right_face"][0]
        cx_face   = (lx + rx) / 2
        fw        = rx - lx

        h_off = (nx - cx_face) / fw if fw else 0
        v_off = (ny - cy) / fw if fw else 0

        if abs(h_off) > HEAD_HORIZ_THRESH:
            pos = "turned_left" if h_off < 0 else "turned_right"
        elif v_off > -HEAD_VERT_DOWN_THRESH:
            pos = "looking_down"
        elif v_off < -HEAD_VERT_UP_THRESH:
            pos = "looking_up"
        else:
            pos = "neutral"

        tilt = np.degrees(np.arctan2(
            lm["mouth_right"][1] - lm["mouth_left"][1],
            lm["mouth_right"][0] - lm["mouth_left"][0],
        ))

        return {
            "position":          pos,
            "tilt_angle":        round(tilt, 1),
            "horizontal_offset": round(h_off, 3),
            "vertical_offset":   round(v_off, 3),
        }

    def _detect_head_movement(self, curr: Dict, prev: Dict) -> Dict[str, Any]:
        """Classify head movement intensity between two consecutive frames."""
        d = np.sqrt(
            (curr["nose_tip"][0] - prev["nose_tip"][0]) ** 2 +
            (curr["nose_tip"][1] - prev["nose_tip"][1]) ** 2
        )
        if d < 5:    t, i = "stable",    0
        elif d < 15: t, i = "slight",    1
        elif d < 30: t, i = "moderate",  2
        else:        t, i = "excessive", 3
        return {"type": t, "intensity": i, "distance": round(d, 2)}

    def _analyze_emotions(
        self, bgr: np.ndarray,
        x1: int, y1: int, x2: int, y2: int
    ) -> Optional[Dict[str, Any]]:
        """
        Run HSEmotion EfficientNet-B2 on the face crop.
        Returns dict with dominant_emotion, emotion_confidence, emotions dict.
        """
        if not EMOTION_AVAILABLE:
            return None
        try:
            pad  = 10
            h, w = bgr.shape[:2]
            fx1, fy1 = max(0, x1 - pad), max(0, y1 - pad)
            fx2, fy2 = min(w, x2 + pad), min(h, y2 + pad)
            crop = bgr[fy1:fy2, fx1:fx2]
            if crop.size == 0:
                return None

            emotion_label, scores = _emotion_model.predict_emotions(
                crop, logits=False)

            emos_pct = {
                label: round(float(score) * 100, 1)
                for label, score in zip(EMOTION_LABELS, scores)
            }
            return {
                "dominant_emotion":   emotion_label.lower(),
                "emotion_confidence": round(float(max(scores)) * 100, 1),
                "emotions":           emos_pct,
            }
        except Exception as e:
            print(f"[VideoAnalyzer] HSEmotion error: {e}")
            return None

    def _detect_nervousness(
        self,
        dominant_emotion: str,
        movement_intensity: int,
        emotion_history: List[Dict],
    ) -> List[str]:
        """Detect nervousness indicators from emotion + movement + history."""
        indicators = []
        if dominant_emotion in ["fear", "surprise"]:
            indicators.append("nervous_expression")
        if movement_intensity >= 2:
            indicators.append("fidgeting")
        if len(emotion_history) >= 5:
            recent = [e["dominant_emotion"] for e in emotion_history[-5:]]
            if len(set(recent)) >= 4:
                indicators.append("emotional_instability")
        return indicators

    def _calculate_engagement(
        self,
        eye_score: float,
        head_pos: str,
        movement_intensity: int,
        emotion: str,
    ) -> float:
        """Composite engagement score (0-100)."""
        s = eye_score
        if head_pos in ["looking_down", "looking_up"]:    s -= 30
        elif head_pos in ["turned_left", "turned_right"]: s -= 20
        if movement_intensity == 3:   s -= 20
        elif movement_intensity == 2: s -= 10
        if emotion in ["happy", "neutral"]:       s += 10
        elif emotion in ["sad", "fear", "angry"]: s -= 15
        return max(0.0, min(100.0, round(s, 1)))

    def _detect_issues(self, a: Dict[str, Any]):
        issues:   List[str] = []
        warnings: List[str] = []

        # Map of issue_key → warning message
        checks = []

        if a["eye_contact_score"] < 30:
            checks.append(("poor_eye_contact", "Look directly at the camera"))
        if a.get("gaze_direction") == "closed":
            checks.append(("eyes_closed", "Keep your eyes open and look at the camera"))

        pos = a["head_position"]
        if pos == "looking_down":
            checks.append(("looking_down", "Keep your head up and look at the camera"))
        elif pos == "looking_up":
            checks.append(("looking_up", "Lower your gaze to camera level"))
        elif pos == "turned_left":
            checks.append(("head_turned_left", "Face the camera — you're turned left"))
        elif pos == "turned_right":
            checks.append(("head_turned_right", "Face the camera — you're turned right"))

        if a.get("movement_intensity", 0) >= 2:
            checks.append(("excessive_movement", "Keep your head steady"))

        if a["engagement_score"] < 50:
            checks.append(("low_engagement", "Stay focused — you seem distracted"))

        emo = a.get("dominant_emotion", "neutral")
        if emo in ["fear", "surprise"]:
            checks.append(("nervous", "Take a deep breath — you're doing great!"))
        elif emo == "sad":
            checks.append(("low_energy", "Try to project more energy and enthusiasm"))
        elif emo == "angry":
            checks.append(("negative_expression", "Relax your expression"))

        if len(a.get("nervousness_indicators", [])) >= 2:
            checks.append(("showing_nervousness", "You seem nervous — breathe and take your time"))

        # Track consecutive frames per issue
        active_issues = {c[0] for c in checks}
        
        for issue_key, warning_msg in checks:
            issues.append(issue_key)
            # Increment consecutive counter
            self._consecutive_issues[issue_key] = \
                self._consecutive_issues.get(issue_key, 0) + 1
            # Only warn after N consecutive frames
            print(f"[DEBUG] {issue_key}: count={self._consecutive_issues[issue_key]}, threshold={self._warning_thresholds.get(issue_key, 3)}")  # ← ADD
            threshold = self._warning_thresholds.get(issue_key, 3)
            if self._consecutive_issues[issue_key] >= threshold:
                warnings.append(warning_msg)

        # Reset counters for issues NOT present this frame
        for key in list(self._consecutive_issues.keys()):
            if key not in active_issues:
                self._consecutive_issues[key] = 0  # ← instant reset when stable

        return issues, warnings

    def _empty_result(self, error_msg: str = "") -> Dict[str, Any]:
        """Empty result structure returned when analysis fails or face not found."""
        return {
            "timestamp":             datetime.utcnow().isoformat(),
            "face_detected":         False,
            "eye_contact_score":     0.0,
            "eye_aspect_ratio":      0.0,
            "gaze_direction":        "unknown",
            "head_position":         "unknown",
            "head_tilt_angle":       0.0,
            "head_horizontal_offset":0.0,
            "head_vertical_offset":  0.0,
            "head_movement":         "stable",
            "movement_intensity":    0,
            "movement_distance":     0.0,
            "emotions":              {e: 0.0 for e in EMOTION_LABELS},
            "dominant_emotion":      "neutral",
            "emotion_confidence":    0.0,
            "nervousness_indicators":[],
            "engagement_score":      0.0,
            "issues":                ["analysis_failed"] if error_msg else [],
            "warnings":              [error_msg] if error_msg else [],
            "error":                 error_msg,
        }