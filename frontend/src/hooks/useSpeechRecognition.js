import { useState, useEffect, useCallback, useRef } from 'react';
import { SPEECH_SETTINGS } from '../utils/constants';

/**
 * Custom hook for browser-based speech recognition
 */
const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef(null);
  const onTranscriptRef = useRef(null);
  const desiredListeningRef = useRef(false);

  /**
   * Initialize speech recognition
   */
  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = 
      window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser');
      return;
    }
    
    setIsSupported(true);
    
    // Create recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = SPEECH_SETTINGS.CONTINUOUS;
    recognition.interimResults = SPEECH_SETTINGS.INTERIM_RESULTS;
    recognition.lang = SPEECH_SETTINGS.LANGUAGE;
    
    // Event handlers
    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setError(null);
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
      // Auto-restart if the consumer still wants to be listening.
      // Some browsers stop recognition intermittently, so restart shortly.
      if (desiredListeningRef.current) {
        console.log('Restarting speech recognition to maintain listening state');
        // small backoff before restarting
        setTimeout(() => {
          try {
            if (recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (err) {
            console.warn('Failed to auto-restart recognition:', err);
          }
        }, 250);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Ignore non-critical errors
      const nonCriticalErrors = ['no-speech', 'aborted'];
      if (nonCriticalErrors.includes(event.error)) {
        // These are expected in normal operation
        if (event.error === 'no-speech') {
          // Just log, don't show error to user
          console.log('No speech detected (this is normal)');
          return;
        }
        return;
      }
      
      let errorMsg = 'Speech recognition error';
      
      switch (event.error) {
        case 'audio-capture':
          errorMsg = 'Microphone not accessible';
          break;
        case 'not-allowed':
          errorMsg = 'Microphone permission denied';
          break;
        case 'network':
          errorMsg = 'Network error';
          break;
        default:
          errorMsg = `Speech recognition error: ${event.error}`;
      }
      
      setError(errorMsg);
      setIsListening(false);
    };
    
    recognition.onresult = (event) => {
      let interimText = '';
      let finalText = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          finalText += text + ' ';
        } else {
          interimText += text;
        }
      }
      
      // Update interim transcript
      if (interimText) {
        setInterimTranscript(interimText);
      }
      
      // Update final transcript
      if (finalText) {
        setTranscript(prev => prev + finalText);
        setInterimTranscript('');
        
        // Call callback if set
        if (onTranscriptRef.current) {
          onTranscriptRef.current(finalText.trim());
        }
      }
    };
    
    recognitionRef.current = recognition;
    
    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  /**
   * Start listening
   */
  const startListening = useCallback((onTranscript) => {
    if (!isSupported) {
      setError('Speech recognition not supported');
      return false;
    }
    
    if (!recognitionRef.current) {
      console.error('Recognition not initialized');
      return false;
    }
    
    // Mark that caller desires listening state (used for auto-restart)
    desiredListeningRef.current = true;

    // If already listening, no-op
    if (isListening) {
      onTranscriptRef.current = onTranscript;
      return true;
    }
    
    try {
      onTranscriptRef.current = onTranscript;
      recognitionRef.current.start();
      // recognition.onstart will set isListening
      return true;
    } catch (err) {
      // Handle "already started" error
      if (err.message && err.message.includes('already started')) {
        console.log('Recognition already started, stopping and restarting...');
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (retryErr) {
              console.error('Error on retry:', retryErr);
              setError(retryErr.message);
            }
          }, 200);
          return true;
        } catch (stopErr) {
          console.error('Error stopping recognition:', stopErr);
          setError(stopErr.message);
          return false;
        }
      }
      console.error('Error starting recognition:', err);
      setError(err.message);
      return false;
    }
  }, [isSupported, isListening]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    // Clear desired flag so auto-restart doesn't occur
    desiredListeningRef.current = false;

    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Error stopping recognition:', err);
      }
    }
  }, [isListening]);

  /**
   * Reset transcript
   */
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  /**
   * Get full transcript (final + interim)
   */
  const getFullTranscript = useCallback(() => {
    return transcript + (interimTranscript ? ' ' + interimTranscript : '');
  }, [transcript, interimTranscript]);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    getFullTranscript,
  };
};

export default useSpeechRecognition;