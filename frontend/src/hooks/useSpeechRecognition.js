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
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      let errorMsg = 'Speech recognition error';
      
      switch (event.error) {
        case 'no-speech':
          errorMsg = 'No speech detected';
          break;
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
    
    if (isListening) {
      return true; // Already listening
    }
    
    try {
      onTranscriptRef.current = onTranscript;
      recognitionRef.current.start();
      return true;
    } catch (err) {
      console.error('Error starting recognition:', err);
      setError(err.message);
      return false;
    }
  }, [isSupported, isListening]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
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