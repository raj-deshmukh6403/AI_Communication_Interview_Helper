"""
audio_analyzer.py
=================
Analyzes audio recordings for vocal characteristics.
Transcribes speech using OpenAI Whisper.

Saves data compatible with:
  - AudioSnapshot (models/session.py) — per-answer summary
  - AnalyticsModel (models/analytics.py) — session-wide summary
  - feedback_generator.py — final feedback report
"""

import librosa
import numpy as np
import base64
import io
import re
import os
import uuid
from typing import Dict, Any, List, Optional
import soundfile as sf
from datetime import datetime

# ─────────────────────────── Whisper ─────────────────────────────────────────
WHISPER_AVAILABLE = False
whisper = None
try:
    import whisper
    WHISPER_AVAILABLE = True
    print("✓ Whisper module imported")
except ImportError:
    print("⚠ Whisper not available — transcription disabled")


class AudioAnalyzer:
    """
    Analyzes audio for vocal characteristics and transcribes speech.

    Two levels of data saved:
      1. Per-answer  : call get_answer_snapshot() after each answer
                       → saved as AudioSnapshot in InterviewResponse
      2. Per-session : call get_session_statistics() at session end
                       → saved in AnalyticsModel
    """

    def __init__(self):
        # Whisper model
        self.whisper_model    = None
        self.whisper_available = WHISPER_AVAILABLE

        if WHISPER_AVAILABLE:
            try:
                print("Loading Whisper model (tiny)...")
                self.whisper_model = whisper.load_model("tiny")
                print("✓ Whisper model loaded")
            except Exception as e:
                print(f"⚠ Whisper load failed: {e}")
                self.whisper_available = False

        # Target speaking metrics
        self.target_pace_min = 125
        self.target_pace_max = 170

        # Filler words
        self.filler_words = [
            "um", "uh", "like", "you know", "basically", "actually",
            "sort of", "kind of", "i mean", "you see", "right", "okay"
        ]

        # ── Session-wide accumulators (reset only on reset()) ─────────────────
        self.total_words          = 0
        self.total_filler_words   = 0
        self.total_speaking_time  = 0.0
        self.pitch_history:  List[float] = []
        self.volume_history: List[float] = []

        # ── Per-answer accumulators (reset on reset_answer()) ─────────────────
        self._answer_chunks:    List[Dict] = []   # raw chunk results per answer
        self._answer_transcript = ""
        self._answer_start_time = datetime.utcnow()

    # ─────────────────────────── Public API ──────────────────────────────────

    def analyze_audio_chunk(
        self,
        audio_data: str,
        transcript: Optional[str] = None,
        sample_rate: int = 16000,
    ) -> Dict[str, Any]:
        """
        Analyze one audio chunk (called multiple times per answer).

        Args:
            audio_data : base64-encoded WAV audio
            transcript : optional pre-provided transcript
            sample_rate: audio sample rate

        Returns:
            Dict with chunk-level metrics + warnings
        """
        try:
            if "," in audio_data:
                audio_data = audio_data.split(",")[1]
            audio_bytes = base64.b64decode(audio_data)
            y, sr = librosa.load(io.BytesIO(audio_bytes), sr=sample_rate)

            analysis = {
                "timestamp":          datetime.utcnow().isoformat(),
                "duration_seconds":   len(y) / sr,
                "transcript":         "",
                "speaking_pace":      0.0,
                "word_count":         0,
                "volume_level":       0.0,
                "volume_consistency": 0.0,
                "pitch_hz":           0.0,
                "pitch_variation":    0.0,
                "filler_words_count": 0,
                "filler_words_detected": [],
                "energy_level":       0.0,
                "pause_time":         0.0,
                "num_pauses":         0,
                "silence_ratio":      0.0,
                "issues":             [],
                "warnings":           [],
            }

            if len(y) < sr * 0.5:
                return analysis

            # Transcribe
            if transcript is None and self.whisper_available and self.whisper_model:
                transcript = self._transcribe_with_whisper(audio_bytes)
            elif transcript is None:
                transcript = ""

            analysis["transcript"] = transcript

            # Acoustic features
            vol  = self._analyze_volume(y)
            pitch = self._analyze_pitch(y, sr)
            pause = self._analyze_pauses(y, sr)

            analysis["volume_level"]       = vol["level"]
            analysis["volume_consistency"] = vol["consistency"]
            analysis["energy_level"]       = vol["energy"]
            analysis["pitch_hz"]           = pitch["mean_pitch"]
            analysis["pitch_variation"]    = pitch["variation"]
            analysis["pause_time"]         = pause["pause_time"]
            analysis["num_pauses"]         = pause["num_pauses"]
            analysis["silence_ratio"]      = pause["silence_ratio"]

            # Text features
            if transcript:
                text = self._analyze_transcript(transcript, analysis["duration_seconds"])
                analysis["speaking_pace"]          = text["pace"]
                analysis["word_count"]             = text["word_count"]
                analysis["filler_words_count"]     = text["filler_count"]
                analysis["filler_words_detected"]  = text["filler_words"]

                # Session accumulators
                self.total_words         += text["word_count"]
                self.total_filler_words  += text["filler_count"]
                # Per-answer transcript accumulation
                self._answer_transcript  += " " + transcript

            # Issues + warnings
            issues, warnings = self._detect_audio_issues(analysis)
            analysis["issues"]   = issues
            analysis["warnings"] = warnings

            # Store for accumulators
            self.volume_history.append(vol["level"])
            if pitch["mean_pitch"] > 0:
                self.pitch_history.append(pitch["mean_pitch"])
            self.total_speaking_time  += analysis["duration_seconds"]
            self._answer_chunks.append(analysis)

            return analysis

        except Exception as e:
            print(f"[AudioAnalyzer] Error: {e}")
            import traceback
            traceback.print_exc()
            return self._empty_result(f"Analysis error: {str(e)}")

    def get_answer_snapshot(self) -> Dict[str, Any]:
        """
        Returns aggregated AudioSnapshot dict for the current answer.
        Call this when user submits their answer, BEFORE reset_answer().

        Returns dict matching AudioSnapshot model in models/session.py:
          transcript, word_count, speaking_duration_seconds,
          avg_speaking_pace_wpm, avg_volume_db, avg_pitch_hz,
          pitch_variation, total_filler_words, filler_word_breakdown,
          silence_percentage, issues
        """
        if not self._answer_chunks:
            return self._empty_snapshot()

        chunks = self._answer_chunks

        # Aggregate
        total_duration  = sum(c["duration_seconds"] for c in chunks)
        total_words     = sum(c.get("word_count", 0) for c in chunks)
        total_fillers   = sum(c.get("filler_words_count", 0) for c in chunks)

        avg_pace    = (total_words / total_duration * 60) if total_duration > 0 else 0
        avg_volume  = float(np.mean([c["volume_level"] for c in chunks]))
        avg_pitch   = float(np.mean([c["pitch_hz"] for c in chunks if c["pitch_hz"] > 0])) \
                      if any(c["pitch_hz"] > 0 for c in chunks) else 0.0
        pitch_var   = float(np.std([c["pitch_hz"] for c in chunks if c["pitch_hz"] > 0])) \
                      if any(c["pitch_hz"] > 0 for c in chunks) else 0.0
        avg_silence = float(np.mean([c["silence_ratio"] for c in chunks]))

        # Filler breakdown as {word: count}
        filler_breakdown: Dict[str, int] = {}
        for chunk in chunks:
            for fw in chunk.get("filler_words_detected", []):
                word  = fw["word"] if isinstance(fw, dict) else fw
                count = fw["count"] if isinstance(fw, dict) else 1
                filler_breakdown[word] = filler_breakdown.get(word, 0) + count

        # Aggregate issues
        all_issues: List[str] = []
        for chunk in chunks:
            all_issues.extend(chunk.get("issues", []))
        unique_issues = list(set(all_issues))

        return {
            "transcript":                self._answer_transcript.strip(),
            "word_count":                total_words,
            "speaking_duration_seconds": round(total_duration, 2),
            "avg_speaking_pace_wpm":     round(avg_pace, 2),
            "avg_volume_db":             round(avg_volume, 2),
            "avg_pitch_hz":              round(avg_pitch, 2),
            "pitch_variation":           round(pitch_var, 2),
            "total_filler_words":        total_fillers,
            "filler_word_breakdown":     filler_breakdown,
            "silence_percentage":        round(avg_silence, 2),
            "issues":                    unique_issues,
        }

    def reset_answer(self):
        """
        Reset per-answer accumulators only.
        Call this after saving get_answer_snapshot() when moving to next question.
        Session-wide stats (total_words, pitch_history etc.) are NOT reset.
        """
        self._answer_chunks     = []
        self._answer_transcript = ""
        self._answer_start_time = datetime.utcnow()

    def get_session_statistics(self) -> Dict[str, Any]:
        """
        Get session-wide aggregated statistics.
        Called by real_time_monitor.get_session_summary() at session end.
        Feeds into AnalyticsModel and feedback_generator.
        """
        avg_pace     = (self.total_words / self.total_speaking_time * 60) \
                       if self.total_speaking_time > 0 else 0
        filler_rate  = (self.total_filler_words / self.total_words * 100) \
                       if self.total_words > 0 else 0

        return {
            "total_speaking_time_seconds": round(self.total_speaking_time, 2),
            "total_words":                 self.total_words,
            "total_filler_words":          self.total_filler_words,
            "average_speaking_pace":       round(avg_pace, 2),
            "filler_word_rate":            round(filler_rate, 2),
            "average_volume":              round(float(np.mean(self.volume_history)), 2)
                                           if self.volume_history else 0.0,
            "average_pitch":               round(float(np.mean(self.pitch_history)), 2)
                                           if self.pitch_history else 0.0,
            "pitch_variation":             round(float(np.std(self.pitch_history)), 2)
                                           if self.pitch_history else 0.0,
        }

    def reset(self):
        """
        Full reset — call at start of new session.
        Resets both session-wide and per-answer accumulators.
        """
        self.total_words         = 0
        self.total_filler_words  = 0
        self.total_speaking_time = 0.0
        self.pitch_history       = []
        self.volume_history      = []
        self.reset_answer()

    # ─────────────────────────── Private helpers ─────────────────────────────

    def _transcribe_with_whisper(self, audio_bytes: bytes) -> str:
        if not self.whisper_available or not self.whisper_model:
            return ""
        try:
            temp_path = f"temp_{uuid.uuid4().hex}.wav"
            audio_data, samplerate = sf.read(io.BytesIO(audio_bytes))
            sf.write(temp_path, audio_data, samplerate)
            result = self.whisper_model.transcribe(
                temp_path, language="en", fp16=False)
            try:
                os.remove(temp_path)
            except:
                pass
            return result["text"].strip()
        except Exception as e:
            print(f"[AudioAnalyzer] Whisper error: {e}")
            return ""

    def _analyze_volume(self, audio: np.ndarray) -> Dict[str, Any]:
        rms        = librosa.feature.rms(y=audio)[0]
        mean_rms   = np.mean(rms)
        std_rms    = np.std(rms)
        vol_level  = float(min(100, mean_rms * 1000))
        if mean_rms > 0:
            consistency = float(max(0, 100 - (std_rms / mean_rms) * 50))
        else:
            consistency = 0.0
        energy = float(np.sum(audio ** 2) / len(audio))
        return {
            "level":       round(vol_level, 2),
            "consistency": round(consistency, 2),
            "energy":      round(energy, 6),
        }

    def _analyze_pitch(self, audio: np.ndarray, sr: int) -> Dict[str, Any]:
        try:
            f0, voiced_flag, _ = librosa.pyin(
                audio,
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C7"),
            )
            voiced_f0 = f0[voiced_flag]
            if len(voiced_f0) > 0:
                mean_p = float(np.nanmean(voiced_f0))
                std_p  = float(np.nanstd(voiced_f0))
                var    = (std_p / mean_p * 100) if mean_p > 0 else 0.0
            else:
                mean_p, var = 0.0, 0.0
            return {
                "mean_pitch": round(mean_p, 2) if not np.isnan(mean_p) else 0.0,
                "variation":  round(var,    2) if not np.isnan(var)    else 0.0,
            }
        except Exception as e:
            print(f"[AudioAnalyzer] Pitch error: {e}")
            return {"mean_pitch": 0.0, "variation": 0.0}

    def _analyze_pauses(self, audio: np.ndarray, sr: int) -> Dict[str, Any]:
        try:
            intervals       = librosa.effects.split(audio, top_db=30)
            total_duration  = len(audio) / sr
            speaking_time   = sum((e - s) / sr for s, e in intervals)
            pause_time      = total_duration - speaking_time
            num_pauses      = max(0, len(intervals) - 1)
            silence_ratio   = (pause_time / total_duration * 100) \
                              if total_duration > 0 else 0.0
            return {
                "pause_time":    round(pause_time, 2),
                "num_pauses":    num_pauses,
                "silence_ratio": round(silence_ratio, 2),
            }
        except Exception as e:
            print(f"[AudioAnalyzer] Pause error: {e}")
            return {"pause_time": 0.0, "num_pauses": 0, "silence_ratio": 0.0}

    def _analyze_transcript(self, transcript: str, duration: float) -> Dict[str, Any]:
        words      = re.findall(r"\b\w+\b", transcript.lower())
        word_count = len(words)
        pace       = (word_count / duration * 60) if duration > 0 else 0.0

        filler_words_found = []
        filler_count       = 0
        transcript_lower   = transcript.lower()

        for filler in self.filler_words:
            count = transcript_lower.count(filler)
            if count > 0:
                filler_count += count
                filler_words_found.append({"word": filler, "count": count})

        return {
            "word_count":  word_count,
            "pace":        round(pace, 2),
            "filler_count": filler_count,
            "filler_words": filler_words_found,
        }

    def _detect_audio_issues(self, analysis: Dict[str, Any]):
        issues, warnings = [], []
        pace = analysis["speaking_pace"]
        if pace > 0:
            if pace > self.target_pace_max:
                issues.append("speaking_too_fast")
                warnings.append("You're speaking too fast — slow down and pause.")
            elif pace < self.target_pace_min:
                issues.append("speaking_too_slow")
                warnings.append("Your pace is too slow — speak more naturally.")
        if analysis["volume_level"] < 10:
            issues.append("volume_too_low")
            warnings.append("Your voice is too quiet — speak louder.")
        elif analysis["volume_level"] > 90:
            issues.append("volume_too_loud")
            warnings.append("Your voice is very loud — speak more softly.")
        if analysis["volume_consistency"] < 30:
            issues.append("inconsistent_volume")
            warnings.append("Your volume is inconsistent — try to maintain steady volume.")
        if analysis["pitch_variation"] < 5 and analysis["pitch_hz"] > 0:
            issues.append("monotone_speech")
            warnings.append("Your speech sounds monotone — vary your pitch for emphasis.")
        if analysis["filler_words_count"] > 3:
            issues.append("excessive_filler_words")
            flist = ", ".join(f["word"] for f in analysis["filler_words_detected"])
            warnings.append(f"Too many filler words ({flist}) — try pausing instead.")
        return issues, warnings

    def _empty_result(self, error_msg: str = "") -> Dict[str, Any]:
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "duration_seconds": 0.0, "transcript": "",
            "speaking_pace": 0.0, "word_count": 0,
            "volume_level": 0.0, "pitch_hz": 0.0,
            "filler_words_count": 0, "filler_words_detected": [],
            "issues": ["analysis_failed"],
            "warnings": [error_msg] if error_msg else [],
            "error": error_msg,
        }

    def _empty_snapshot(self) -> Dict[str, Any]:
        return {
            "transcript": "", "word_count": 0,
            "speaking_duration_seconds": 0.0,
            "avg_speaking_pace_wpm": 0.0, "avg_volume_db": 0.0,
            "avg_pitch_hz": 0.0, "pitch_variation": 0.0,
            "total_filler_words": 0, "filler_word_breakdown": {},
            "silence_percentage": 0.0, "issues": [],
        }