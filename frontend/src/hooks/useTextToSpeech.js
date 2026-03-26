import { useCallback, useEffect, useState } from 'react';

/**
 * Simple Text‑to‑Speech hook using the Web Speech API.
 * Falls back gracefully when not supported.
 */
const useTextToSpeech = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  const cancel = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    } catch (e) {
      // ignore
    }
  }, []);

  const speak = useCallback(
    (text, { lang = 'en-US', rate = 1, pitch = 1, volume = 1 } = {}) => {
      if (!isSupported || !text) return;

      try {
        // Stop any ongoing speech first
        cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;

        utterance.onstart = () => {
          setIsSpeaking(true);
          setError(null);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
        };

        utterance.onerror = (event) => {
          console.error('Speech synthesis error:', event.error);
          setError(event.error || 'Speech synthesis error');
          setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error('TTS speak error:', e);
        setError(e.message || 'Unable to start text‑to‑speech');
        setIsSpeaking(false);
      }
    },
    [cancel, isSupported]
  );

  return {
    isSupported,
    isSpeaking,
    error,
    speak,
    cancel,
  };
};

export default useTextToSpeech;

