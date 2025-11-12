import { useState, useEffect, useCallback, useRef } from 'react';
import { SPEECH_SETTINGS } from '../utils/constants';

/**
 * FIXED: Custom hook for browser-based speech recognition
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
  const isInitializedRef = useRef(false);

  /**
   * Initialize speech recognition
   */
  useEffect(() => {
    console.log('🎤 Initializing speech recognition...');
    
    // Check if browser supports speech recognition
    const SpeechRecognition = 
      window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('❌ Speech recognition not supported in this browser');
      setIsSupported(false);
      setError('Speech recognition not supported. Please use Chrome, Edge, or Safari.');
      return;
    }
    
    console.log('✅ Speech recognition supported');
    setIsSupported(true);
    
    // Create recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    console.log('🔧 Speech recognition configured:', {
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      lang: recognition.lang
    });
    
    // Event handlers
    recognition.onstart = () => {
      console.log('🎙️ Speech recognition STARTED');
      setIsListening(true);
      setError(null);
    };
    
    recognition.onend = () => {
      console.log('🛑 Speech recognition ENDED');
      setIsListening(false);
      
      // CRITICAL: Auto-restart if still desired
      if (desiredListeningRef.current) {
        console.log('🔄 Auto-restarting speech recognition...');
        setTimeout(() => {
          try {
            if (recognitionRef.current && desiredListeningRef.current) {
              recognitionRef.current.start();
              console.log('✅ Speech recognition restarted');
            }
          } catch (err) {
            console.warn('⚠️ Could not restart recognition:', err.message);
            // Try again with longer delay
            setTimeout(() => {
              try {
                if (recognitionRef.current && desiredListeningRef.current) {
                  recognitionRef.current.start();
                  console.log('✅ Speech recognition restarted (retry)');
                }
              } catch (e) {
                console.error('❌ Failed to restart after retry:', e.message);
              }
            }, 1000);
          }
        }, 250);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('❌ Speech recognition error:', event.error);
      
      // Ignore non-critical errors
      const nonCriticalErrors = ['no-speech', 'aborted'];
      if (nonCriticalErrors.includes(event.error)) {
        if (event.error === 'no-speech') {
          console.log('⚠️ No speech detected (this is normal)');
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
          errorMsg = `Speech error: ${event.error}`;
      }
      
      console.error('🚨', errorMsg);
      setError(errorMsg);
      setIsListening(false);
    };
    
    recognition.onresult = (event) => {
      console.log('📝 Speech result received');
      
      let interimText = '';
      let finalText = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          finalText += text + ' ';
          console.log('✅ Final transcript:', text);
        } else {
          interimText += text;
          console.log('⏳ Interim transcript:', text);
        }
      }
      
      // Update interim transcript
      if (interimText) {
        setInterimTranscript(interimText);
      }
      
      // Update final transcript
      if (finalText) {
        setTranscript(prev => {
          const updated = prev + finalText;
          console.log('📄 Updated full transcript:', updated);
          return updated;
        });
        setInterimTranscript('');
        
        // Call callback if set
        if (onTranscriptRef.current) {
          onTranscriptRef.current(finalText.trim());
        }
      }
    };
    
    recognitionRef.current = recognition;
    isInitializedRef.current = true;
    console.log('✅ Speech recognition initialized');
    
    // Cleanup
    return () => {
      console.log('🧹 Cleaning up speech recognition...');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Cleanup stop error:', e);
        }
      }
      isInitializedRef.current = false;
    };
  }, []);

  /**
   * Start listening
   */
  const startListening = useCallback((onTranscript) => {
    console.log('🎙️ startListening() called');
    
    if (!isSupported) {
      console.error('❌ Speech recognition not supported');
      setError('Speech recognition not supported');
      return false;
    }
    
    if (!recognitionRef.current) {
      console.error('❌ Recognition not initialized');
      return false;
    }
    
    // Mark that caller desires listening state
    desiredListeningRef.current = true;
    console.log('✅ Desired listening state: true');

    // If already listening, just update callback
    if (isListening) {
      console.log('ℹ️ Already listening, updating callback');
      onTranscriptRef.current = onTranscript;
      return true;
    }
    
    try {
      onTranscriptRef.current = onTranscript;
      console.log('🚀 Starting speech recognition...');
      recognitionRef.current.start();
      return true;
    } catch (err) {
      // Handle "already started" error
      if (err.message && err.message.includes('already started')) {
        console.log('⚠️ Recognition already started, restarting...');
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
              console.log('✅ Restarted successfully');
            } catch (retryErr) {
              console.error('❌ Retry start failed:', retryErr);
              setError(retryErr.message);
            }
          }, 200);
          return true;
        } catch (stopErr) {
          console.error('❌ Stop failed:', stopErr);
          setError(stopErr.message);
          return false;
        }
      }
      console.error('❌ Start failed:', err);
      setError(err.message);
      return false;
    }
  }, [isSupported, isListening]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    console.log('⏹️ stopListening() called');
    
    // Clear desired flag so auto-restart doesn't occur
    desiredListeningRef.current = false;
    console.log('✅ Desired listening state: false');

    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        console.log('✅ Speech recognition stopped');
      } catch (err) {
        console.warn('⚠️ Stop error:', err);
      }
    }
  }, [isListening]);

  /**
   * Reset transcript
   */
  const resetTranscript = useCallback(() => {
    console.log('🔄 Resetting transcript');
    setTranscript('');
    setInterimTranscript('');
  }, []);

  /**
   * Get full transcript (final + interim)
   */
  const getFullTranscript = useCallback(() => {
    const full = transcript + (interimTranscript ? ' ' + interimTranscript : '');
    return full;
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