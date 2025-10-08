# import librosa
# import numpy as np
# import base64
# import io
# from typing import Dict, Any, List, Optional
# import soundfile as sf
# from datetime import datetime
# import re
# import whisper
# import tempfile
# import os

# class AudioAnalyzer:
#     """
#     Analyzes audio for vocal characteristics and transcribes speech using Whisper.
#     """
    
#     def __init__(self):
#         # Load Whisper model (using 'base' for balance of speed and accuracy)
#         # Options: 'tiny', 'base', 'small', 'medium', 'large'
#         # 'tiny' and 'base' are fastest, good for real-time
#         print("Loading Whisper model...")
#         self.whisper_model = whisper.load_model("base")
#         print("✓ Whisper model loaded")
        
#         # Target speaking metrics
#         self.target_speaking_rate = 150  # words per minute
#         self.target_pace_min = 130
#         self.target_pace_max = 170
        
#         # Filler words to detect
#         self.filler_words = [
#             "um", "uh", "like", "you know", "basically", "actually",
#             "sort of", "kind of", "i mean", "you see", "right", "okay"
#         ]
        
#         # Voice quality thresholds
#         self.min_volume_threshold = 0.01
#         self.max_volume_threshold = 0.5
        
#         # Track statistics across session
#         self.total_words = 0
#         self.total_filler_words = 0
#         self.total_speaking_time = 0
#         self.pitch_history = []
#         self.volume_history = []
    
#     def analyze_audio_chunk(
#         self, 
#         audio_data: str, 
#         transcript: Optional[str] = None,
#         sample_rate: int = 16000
#     ) -> Dict[str, Any]:
#         """
#         Analyze a chunk of audio for vocal characteristics and transcribe it.
        
#         Args:
#             audio_data: Base64 encoded audio data (WAV format)
#             transcript: Optional pre-provided transcript (if None, will use Whisper)
#             sample_rate: Audio sample rate
        
#         Returns:
#             Dictionary with analysis results including transcript
#         """
#         try:
#             # Decode base64 audio
#             if ',' in audio_data:
#                 audio_data = audio_data.split(',')[1]
            
#             audio_bytes = base64.b64decode(audio_data)
            
#             # Load audio with librosa
#             y, sr = librosa.load(io.BytesIO(audio_bytes), sr=sample_rate)
            
#             analysis = {
#                 "timestamp": datetime.utcnow().isoformat(),
#                 "duration_seconds": len(y) / sr,
#                 "transcript": "",
#                 "speaking_pace": 0,
#                 "volume_level": 0,
#                 "volume_consistency": 0,
#                 "pitch_hz": 0,
#                 "pitch_variation": 0,
#                 "filler_words_count": 0,
#                 "filler_words_detected": [],
#                 "energy_level": 0,
#                 "issues": [],
#                 "warnings": []
#             }
            
#             # Skip analysis if audio is too short
#             if len(y) < sr * 0.5:  # Less than 0.5 seconds
#                 return analysis
            
#             # Transcribe with Whisper if no transcript provided
#             if transcript is None:
#                 transcript = self._transcribe_with_whisper(audio_bytes)
            
#             analysis["transcript"] = transcript
            
#             # Analyze volume (RMS energy)
#             volume_analysis = self._analyze_volume(y)
#             analysis["volume_level"] = volume_analysis["level"]
#             analysis["volume_consistency"] = volume_analysis["consistency"]
#             analysis["energy_level"] = volume_analysis["energy"]
            
#             # Analyze pitch
#             pitch_analysis = self._analyze_pitch(y, sr)
#             analysis["pitch_hz"] = pitch_analysis["mean_pitch"]
#             analysis["pitch_variation"] = pitch_analysis["variation"]
            
#             # Analyze speaking pace and filler words from transcript
#             if transcript:
#                 text_analysis = self._analyze_transcript(
#                     transcript, 
#                     analysis["duration_seconds"]
#                 )
#                 analysis["speaking_pace"] = text_analysis["pace"]
#                 analysis["word_count"] = text_analysis["word_count"]
#                 analysis["filler_words_count"] = text_analysis["filler_count"]
#                 analysis["filler_words_detected"] = text_analysis["filler_words"]
                
#                 # Update session statistics
#                 self.total_words += text_analysis["word_count"]
#                 self.total_filler_words += text_analysis["filler_count"]
            
#             # Detect issues and generate warnings
#             issues, warnings = self._detect_audio_issues(analysis)
#             analysis["issues"] = issues
#             analysis["warnings"] = warnings
            
#             # Store for session statistics
#             self.volume_history.append(volume_analysis["level"])
#             if pitch_analysis["mean_pitch"] > 0:
#                 self.pitch_history.append(pitch_analysis["mean_pitch"])
#             self.total_speaking_time += analysis["duration_seconds"]
            
#             return analysis
            
#         except Exception as e:
#             print(f"Error in audio analysis: {e}")
#             return self._get_empty_result(f"Analysis error: {str(e)}")
    
#     def _transcribe_with_whisper(self, audio_bytes: bytes) -> str:
#         """
#         Transcribe audio using Whisper.
        
#         Args:
#             audio_bytes: Raw audio bytes
        
#         Returns:
#             Transcribed text
#         """
#         try:
#             # Save audio to temporary file (Whisper needs a file path)
#             with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
#                 temp_audio.write(audio_bytes)
#                 temp_path = temp_audio.name
            
#             # Transcribe with Whisper
#             result = self.whisper_model.transcribe(
#                 temp_path,
#                 language='en',  # Force English
#                 fp16=False  # Use float32 for better compatibility
#             )
            
#             # Clean up temp file
#             os.unlink(temp_path)
            
#             return result['text'].strip()
            
#         except Exception as e:
#             print(f"Error in Whisper transcription: {e}")
#             return ""
    
#     def _analyze_volume(self, audio: np.ndarray) -> Dict[str, Any]:
#         """Analyze volume/loudness of audio."""
#         # Calculate RMS energy
#         rms = librosa.feature.rms(y=audio)[0]
#         mean_rms = np.mean(rms)
#         std_rms = np.std(rms)
        
#         # Normalize to 0-100 scale
#         volume_level = min(100, (mean_rms / self.max_volume_threshold) * 100)
        
#         # Consistency score
#         consistency = max(0, 100 - (std_rms / mean_rms * 100)) if mean_rms > 0 else 0
        
#         # Energy level
#         energy = np.sum(audio ** 2) / len(audio)
        
#         return {
#             "level": round(volume_level, 2),
#             "consistency": round(consistency, 2),
#             "energy": round(energy, 6)
#         }
    
#     def _analyze_pitch(self, audio: np.ndarray, sr: int) -> Dict[str, Any]:
#         """Analyze pitch (fundamental frequency) of speech."""
#         try:
#             # Extract pitch using librosa's pyin algorithm
#             f0, voiced_flag, voiced_probs = librosa.pyin(
#                 audio,
#                 fmin=librosa.note_to_hz('C2'),
#                 fmax=librosa.note_to_hz('C7')
#             )
            
#             # Filter to only voiced segments
#             voiced_f0 = f0[voiced_flag]
            
#             if len(voiced_f0) > 0:
#                 mean_pitch = np.nanmean(voiced_f0)
#                 std_pitch = np.nanstd(voiced_f0)
#                 variation = (std_pitch / mean_pitch * 100) if mean_pitch > 0 else 0
#             else:
#                 mean_pitch = 0
#                 variation = 0
            
#             return {
#                 "mean_pitch": round(float(mean_pitch), 2) if not np.isnan(mean_pitch) else 0,
#                 "variation": round(float(variation), 2) if not np.isnan(variation) else 0
#             }
            
#         except Exception as e:
#             print(f"Error in pitch analysis: {e}")
#             return {"mean_pitch": 0, "variation": 0}
    
#     def _analyze_transcript(self, transcript: str, duration: float) -> Dict[str, Any]:
#         """Analyze transcript text for speaking pace and filler words."""
#         # Clean and split into words
#         words = re.findall(r'\b\w+\b', transcript.lower())
#         word_count = len(words)
        
#         # Calculate speaking pace (words per minute)
#         pace = (word_count / duration * 60) if duration > 0 else 0
        
#         # Detect filler words
#         filler_words_found = []
#         filler_count = 0
        
#         transcript_lower = transcript.lower()
#         for filler in self.filler_words:
#             count = transcript_lower.count(filler)
#             if count > 0:
#                 filler_count += count
#                 filler_words_found.append({
#                     "word": filler,
#                     "count": count
#                 })
        
#         return {
#             "word_count": word_count,
#             "pace": round(pace, 2),
#             "filler_count": filler_count,
#             "filler_words": filler_words_found
#         }
    
#     def _detect_audio_issues(self, analysis: Dict[str, Any]) -> tuple:
#         """
#         Detect issues in audio and generate warnings.
        
#         Returns:
#             Tuple of (issues list, warnings list)
#         """
#         issues = []
#         warnings = []
        
#         # Check speaking pace
#         pace = analysis["speaking_pace"]
#         if pace > 0:
#             if pace > self.target_pace_max:
#                 issues.append("speaking_too_fast")
#                 warnings.append("You're speaking quite fast. Try to slow down and take pauses.")
#             elif pace < self.target_pace_min:
#                 issues.append("speaking_too_slow")
#                 warnings.append("Your pace is a bit slow. Try to speak more naturally.")
        
#         # Check volume
#         if analysis["volume_level"] < 20:
#             issues.append("volume_too_low")
#             warnings.append("Your voice is too quiet. Please speak louder.")
#         elif analysis["volume_level"] > 90:
#             issues.append("volume_too_loud")
#             warnings.append("Your voice is very loud. Try speaking more softly.")
        
#         # Check volume consistency
#         if analysis["volume_consistency"] < 50:
#             issues.append("inconsistent_volume")
#             warnings.append("Your volume is inconsistent. Try to maintain steady volume.")
        
#         # Check pitch variation (monotone detection)
#         if analysis["pitch_variation"] < 5 and analysis["pitch_hz"] > 0:
#             issues.append("monotone_speech")
#             warnings.append("Your speech sounds monotone. Try varying your pitch for emphasis.")
        
#         # Check filler words
#         if analysis["filler_words_count"] > 3:
#             issues.append("excessive_filler_words")
#             filler_list = ", ".join([f["word"] for f in analysis["filler_words_detected"]])
#             warnings.append(f"You're using filler words ({filler_list}). Try to eliminate them.")
        
#         return issues, warnings
    
#     def get_session_statistics(self) -> Dict[str, Any]:
#         """
#         Get overall statistics for the entire session.
        
#         Returns:
#             Dictionary with session-wide metrics
#         """
#         avg_pace = (self.total_words / self.total_speaking_time * 60) if self.total_speaking_time > 0 else 0
#         filler_rate = (self.total_filler_words / self.total_words * 100) if self.total_words > 0 else 0
        
#         return {
#             "total_speaking_time_seconds": round(self.total_speaking_time, 2),
#             "total_words": self.total_words,
#             "total_filler_words": self.total_filler_words,
#             "average_speaking_pace": round(avg_pace, 2),
#             "filler_word_rate": round(filler_rate, 2),
#             "average_volume": round(np.mean(self.volume_history), 2) if self.volume_history else 0,
#             "average_pitch": round(np.mean(self.pitch_history), 2) if self.pitch_history else 0,
#             "pitch_variation": round(np.std(self.pitch_history), 2) if self.pitch_history else 0
#         }
    
#     def _get_empty_result(self, error_msg: str = "") -> Dict[str, Any]:
#         """Return empty result when analysis fails."""
#         return {
#             "timestamp": datetime.utcnow().isoformat(),
#             "duration_seconds": 0,
#             "speaking_pace": 0,
#             "volume_level": 0,
#             "pitch_hz": 0,
#             "filler_words_count": 0,
#             "issues": ["analysis_failed"],
#             "warnings": [error_msg] if error_msg else [],
#             "error": error_msg
#         }
    
#     def reset(self):
#         """Reset analyzer for new session."""
#         self.total_words = 0
#         self.total_filler_words = 0
#         self.total_speaking_time = 0
#         self.pitch_history = []
#         self.volume_history = []
import librosa
import numpy as np
import base64
import io
from typing import Dict, Any, List, Optional
import soundfile as sf
from datetime import datetime
import re
import tempfile
import os

# Try to import Whisper
WHISPER_AVAILABLE = False
whisper = None
try:
    import whisper
    WHISPER_AVAILABLE = True
    print("✓ Whisper module imported")
except ImportError:
    print("⚠ Whisper not available - transcription will be disabled")

class AudioAnalyzer:
    """
    Analyzes audio for vocal characteristics and transcribes speech using Whisper.
    """
    
    def __init__(self):
        # Load Whisper model (using 'base' for balance of speed and accuracy)
        self.whisper_model = None
        self.whisper_available = WHISPER_AVAILABLE
        
        if WHISPER_AVAILABLE:
            try:
                print("Loading Whisper model (this may take a moment)...")
                self.whisper_model = whisper.load_model("base")
                print("✓ Whisper model loaded successfully")
            except Exception as e:
                print(f"⚠ Failed to load Whisper model: {e}")
                print("  Transcription will use fallback method")
                self.whisper_available = False
        
        # Target speaking metrics
        self.target_speaking_rate = 150  # words per minute
        self.target_pace_min = 130
        self.target_pace_max = 170
        
        # Filler words to detect
        self.filler_words = [
            "um", "uh", "like", "you know", "basically", "actually",
            "sort of", "kind of", "i mean", "you see", "right", "okay"
        ]
        
        # Voice quality thresholds
        self.min_volume_threshold = 0.01
        self.max_volume_threshold = 0.5
        
        # Track statistics across session
        self.total_words = 0
        self.total_filler_words = 0
        self.total_speaking_time = 0
        self.pitch_history = []
        self.volume_history = []
    
    def analyze_audio_chunk(
        self, 
        audio_data: str, 
        transcript: Optional[str] = None,
        sample_rate: int = 16000
    ) -> Dict[str, Any]:
        """
        Analyze a chunk of audio for vocal characteristics and transcribe it.
        
        Args:
            audio_data: Base64 encoded audio data (WAV format)
            transcript: Optional pre-provided transcript (if None, will try Whisper)
            sample_rate: Audio sample rate
        
        Returns:
            Dictionary with analysis results including transcript
        """
        try:
            # Decode base64 audio
            if ',' in audio_data:
                audio_data = audio_data.split(',')[1]
            
            audio_bytes = base64.b64decode(audio_data)
            
            # Load audio with librosa
            y, sr = librosa.load(io.BytesIO(audio_bytes), sr=sample_rate)
            
            analysis = {
                "timestamp": datetime.utcnow().isoformat(),
                "duration_seconds": len(y) / sr,
                "transcript": "",
                "speaking_pace": 0,
                "volume_level": 0,
                "volume_consistency": 0,
                "pitch_hz": 0,
                "pitch_variation": 0,
                "filler_words_count": 0,
                "filler_words_detected": [],
                "energy_level": 0,
                "issues": [],
                "warnings": []
            }
            
            # Skip analysis if audio is too short
            if len(y) < sr * 0.5:  # Less than 0.5 seconds
                return analysis
            
            # Transcribe with Whisper if no transcript provided AND Whisper available
            if transcript is None and self.whisper_available and self.whisper_model:
                transcript = self._transcribe_with_whisper(audio_bytes)
            elif transcript is None:
                transcript = ""  # No transcript available
            
            analysis["transcript"] = transcript
            
            # Analyze volume (RMS energy)
            volume_analysis = self._analyze_volume(y)
            analysis["volume_level"] = volume_analysis["level"]
            analysis["volume_consistency"] = volume_analysis["consistency"]
            analysis["energy_level"] = volume_analysis["energy"]
            
            # Analyze pitch
            pitch_analysis = self._analyze_pitch(y, sr)
            analysis["pitch_hz"] = pitch_analysis["mean_pitch"]
            analysis["pitch_variation"] = pitch_analysis["variation"]
            
            # Analyze speaking pace and filler words from transcript
            if transcript:
                text_analysis = self._analyze_transcript(
                    transcript, 
                    analysis["duration_seconds"]
                )
                analysis["speaking_pace"] = text_analysis["pace"]
                analysis["word_count"] = text_analysis["word_count"]
                analysis["filler_words_count"] = text_analysis["filler_count"]
                analysis["filler_words_detected"] = text_analysis["filler_words"]
                
                # Update session statistics
                self.total_words += text_analysis["word_count"]
                self.total_filler_words += text_analysis["filler_count"]
            
            # Detect issues and generate warnings
            issues, warnings = self._detect_audio_issues(analysis)
            analysis["issues"] = issues
            analysis["warnings"] = warnings
            
            # Store for session statistics
            self.volume_history.append(volume_analysis["level"])
            if pitch_analysis["mean_pitch"] > 0:
                self.pitch_history.append(pitch_analysis["mean_pitch"])
            self.total_speaking_time += analysis["duration_seconds"]
            
            return analysis
            
        except Exception as e:
            print(f"Error in audio analysis: {e}")
            import traceback
            traceback.print_exc()
            return self._get_empty_result(f"Analysis error: {str(e)}")
    
    def _transcribe_with_whisper(self, audio_bytes: bytes) -> str:
        """
        Transcribe audio using Whisper.
        
        Args:
            audio_bytes: Raw audio bytes
        
        Returns:
            Transcribed text
        """
        if not self.whisper_available or not self.whisper_model:
            return ""
            
        try:
            # Save audio to temporary file (Whisper needs a file path)
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
                temp_audio.write(audio_bytes)
                temp_path = temp_audio.name
            
            # Transcribe with Whisper
            result = self.whisper_model.transcribe(
                temp_path,
                language='en',  # Force English
                fp16=False  # Use float32 for better compatibility
            )
            
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except:
                pass
            
            return result['text'].strip()
            
        except Exception as e:
            print(f"Error in Whisper transcription: {e}")
            return ""
    
    def _analyze_volume(self, audio: np.ndarray) -> Dict[str, Any]:
        """Analyze volume/loudness of audio."""
        # Calculate RMS energy
        rms = librosa.feature.rms(y=audio)[0]
        mean_rms = np.mean(rms)
        std_rms = np.std(rms)
        
        # Normalize to 0-100 scale
        volume_level = min(100, (mean_rms / self.max_volume_threshold) * 100)
        
        # Consistency score
        consistency = max(0, 100 - (std_rms / mean_rms * 100)) if mean_rms > 0 else 0
        
        # Energy level
        energy = np.sum(audio ** 2) / len(audio)
        
        return {
            "level": round(volume_level, 2),
            "consistency": round(consistency, 2),
            "energy": round(energy, 6)
        }
    
    def _analyze_pitch(self, audio: np.ndarray, sr: int) -> Dict[str, Any]:
        """Analyze pitch (fundamental frequency) of speech."""
        try:
            # Extract pitch using librosa's pyin algorithm
            f0, voiced_flag, voiced_probs = librosa.pyin(
                audio,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7')
            )
            
            # Filter to only voiced segments
            voiced_f0 = f0[voiced_flag]
            
            if len(voiced_f0) > 0:
                mean_pitch = np.nanmean(voiced_f0)
                std_pitch = np.nanstd(voiced_f0)
                variation = (std_pitch / mean_pitch * 100) if mean_pitch > 0 else 0
            else:
                mean_pitch = 0
                variation = 0
            
            return {
                "mean_pitch": round(float(mean_pitch), 2) if not np.isnan(mean_pitch) else 0,
                "variation": round(float(variation), 2) if not np.isnan(variation) else 0
            }
            
        except Exception as e:
            print(f"Error in pitch analysis: {e}")
            return {"mean_pitch": 0, "variation": 0}
    
    def _analyze_transcript(self, transcript: str, duration: float) -> Dict[str, Any]:
        """Analyze transcript text for speaking pace and filler words."""
        # Clean and split into words
        words = re.findall(r'\b\w+\b', transcript.lower())
        word_count = len(words)
        
        # Calculate speaking pace (words per minute)
        pace = (word_count / duration * 60) if duration > 0 else 0
        
        # Detect filler words
        filler_words_found = []
        filler_count = 0
        
        transcript_lower = transcript.lower()
        for filler in self.filler_words:
            count = transcript_lower.count(filler)
            if count > 0:
                filler_count += count
                filler_words_found.append({
                    "word": filler,
                    "count": count
                })
        
        return {
            "word_count": word_count,
            "pace": round(pace, 2),
            "filler_count": filler_count,
            "filler_words": filler_words_found
        }
    
    def _detect_audio_issues(self, analysis: Dict[str, Any]) -> tuple:
        """
        Detect issues in audio and generate warnings.
        
        Returns:
            Tuple of (issues list, warnings list)
        """
        issues = []
        warnings = []
        
        # Check speaking pace
        pace = analysis["speaking_pace"]
        if pace > 0:
            if pace > self.target_pace_max:
                issues.append("speaking_too_fast")
                warnings.append("You're speaking quite fast. Try to slow down and take pauses.")
            elif pace < self.target_pace_min:
                issues.append("speaking_too_slow")
                warnings.append("Your pace is a bit slow. Try to speak more naturally.")
        
        # Check volume
        if analysis["volume_level"] < 20:
            issues.append("volume_too_low")
            warnings.append("Your voice is too quiet. Please speak louder.")
        elif analysis["volume_level"] > 90:
            issues.append("volume_too_loud")
            warnings.append("Your voice is very loud. Try speaking more softly.")
        
        # Check volume consistency
        if analysis["volume_consistency"] < 50:
            issues.append("inconsistent_volume")
            warnings.append("Your volume is inconsistent. Try to maintain steady volume.")
        
        # Check pitch variation (monotone detection)
        if analysis["pitch_variation"] < 5 and analysis["pitch_hz"] > 0:
            issues.append("monotone_speech")
            warnings.append("Your speech sounds monotone. Try varying your pitch for emphasis.")
        
        # Check filler words
        if analysis["filler_words_count"] > 3:
            issues.append("excessive_filler_words")
            filler_list = ", ".join([f["word"] for f in analysis["filler_words_detected"]])
            warnings.append(f"You're using filler words ({filler_list}). Try to eliminate them.")
        
        return issues, warnings
    
    def get_session_statistics(self) -> Dict[str, Any]:
        """
        Get overall statistics for the entire session.
        
        Returns:
            Dictionary with session-wide metrics
        """
        avg_pace = (self.total_words / self.total_speaking_time * 60) if self.total_speaking_time > 0 else 0
        filler_rate = (self.total_filler_words / self.total_words * 100) if self.total_words > 0 else 0
        
        return {
            "total_speaking_time_seconds": round(self.total_speaking_time, 2),
            "total_words": self.total_words,
            "total_filler_words": self.total_filler_words,
            "average_speaking_pace": round(avg_pace, 2),
            "filler_word_rate": round(filler_rate, 2),
            "average_volume": round(np.mean(self.volume_history), 2) if self.volume_history else 0,
            "average_pitch": round(np.mean(self.pitch_history), 2) if self.pitch_history else 0,
            "pitch_variation": round(np.std(self.pitch_history), 2) if self.pitch_history else 0
        }
    
    def _get_empty_result(self, error_msg: str = "") -> Dict[str, Any]:
        """Return empty result when analysis fails."""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "duration_seconds": 0,
            "transcript": "",
            "speaking_pace": 0,
            "volume_level": 0,
            "pitch_hz": 0,
            "filler_words_count": 0,
            "issues": ["analysis_failed"],
            "warnings": [error_msg] if error_msg else [],
            "error": error_msg
        }
    
    def reset(self):
        """Reset analyzer for new session."""
        self.total_words = 0
        self.total_filler_words = 0
        self.total_speaking_time = 0
        self.pitch_history = []
        self.volume_history = []