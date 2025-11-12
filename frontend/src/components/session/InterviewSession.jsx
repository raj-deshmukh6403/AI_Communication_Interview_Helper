import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Mic, MicOff, Video, VideoOff, X, CheckCircle } from 'lucide-react';
import useWebSocket from '../../hooks/useWebSocket';
import useMediaRecorder from '../../hooks/useMediaRecorder';
import useSpeechRecognition from '../../hooks/useSpeechRecognition';
import QuestionOverlay from './QuestionOverlay';
import InterventionAlert from './InterventionAlert';
import SessionComplete from './SessionComplete';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Loader from '../common/Loader';
import { WS_MESSAGE_TYPES, VIDEO_SETTINGS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';

/**
 * Main Interview Session Component
 * Handles real-time video/audio recording, WebSocket communication, and interview flow
 */
const InterviewSession = ({ sessionId }) => {
  const navigate = useNavigate();

  // WebSocket connection
  const {
    isConnected,
    connect,
    disconnect,
    on,
    off,
    sendVideoFrame,
    sendAudioChunk,
    sendAnswer,
    endSession,
  } = useWebSocket(sessionId);

  // Media recording
  const {
    videoRef,
    hasPermissions,
    isCameraEnabled,
    isMicEnabled,
    isRecording,
    error: mediaError,
    requestPermissions,
    startRecording,
    stopRecording,
    toggleCamera,
    toggleMicrophone,
  } = useMediaRecorder();

  // Speech recognition - ENABLED for voice answers
  const {
    isSupported: isSpeechSupported,
    isListening,
    transcript,
    interimTranscript,
    resetTranscript,
    startListening,
    stopListening,
    getFullTranscript,
  } = useSpeechRecognition();

  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answer, setAnswer] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [answerStartTime, setAnswerStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [interventions, setInterventions] = useState([]);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [finalFeedback, setFinalFeedback] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [error, setError] = useState(null);
  const [isQuestionMinimized, setIsQuestionMinimized] = useState(false);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  
  // Auto-submit timer - submit answer after user stops speaking for 3 seconds
  const autoSubmitTimerRef = useRef(null);

  // Refs
  const videoFrameIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Initialize session
  useEffect(() => {
    const init = async () => {
      try {
        setError(null);
        // Request media permissions
        await requestPermissions();
        // Connect WebSocket
        await connect();
        setIsInitialized(true);
      } catch (err) {
        console.error('Initialization error:', err);
        setError(getErrorMessage(err));
      }
    };

    init();

    return () => {
      stopRecording();
      stopListening();
      disconnect();
      // Capture ref values for cleanup (refs are stable, but linter requires this pattern)
      const videoFrameInterval = videoFrameIntervalRef.current;
      const timerInterval = timerIntervalRef.current;
      if (videoFrameInterval) {
        clearInterval(videoFrameInterval);
      }
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
    // Note: We intentionally don't include dependencies here as this effect should only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Setup WebSocket message handlers
  useEffect(() => {
    if (!isConnected) return;

    // Define handlers
    const handleAuthSuccess = (message) => {
      console.log('Authenticated:', message);
    };

    const handleSessionStarted = (message) => {
      console.log('Session started:', message);
      setTotalQuestions(message.total_questions || 5);
      
      // Auto-start recording if not already started (but prevent duplicate calls)
      if (!isSessionStarted && hasPermissions && !hasAutoStartedRef.current) {
        console.log('Starting recording after session started...');
        hasAutoStartedRef.current = true;
        setTimeout(() => {
          handleStartInterview();
        }, 500);
      }
    };

    const handleNextQuestion = (message) => {
      console.log('Next question:', message);
      setCurrentQuestion(message.question);
      setQuestionNumber(message.question_number);
      setAnswer('');
      setAnswerSubmitted(false);
      resetTranscript();
      setIsAnswering(true);
      setAnswerStartTime(Date.now());
      setElapsedTime(0);
      setIsQuestionMinimized(false);
      
      // Start speech recognition for new question (after a delay to ensure previous one stopped)
      if (isSpeechSupported && isSessionStarted) {
        // Wait a bit to ensure previous recognition has stopped
        setTimeout(() => {
          try {
            startListening((finalTranscript) => {
              console.log('Final transcript:', finalTranscript);
            });
          } catch (error) {
            console.warn('Failed to start speech recognition for new question:', error);
          }
        }, 300);
      }
      
      // If session not started yet, start it now (but prevent duplicate calls)
      if (!isSessionStarted && hasPermissions && !hasAutoStartedRef.current) {
        hasAutoStartedRef.current = true;
        handleStartInterview();
      }
    };

    const handleAnalytics = (message) => {
      console.log('Analytics:', message);
    };

    const handleIntervention = (message) => {
      console.log('Intervention:', message);
      const intervention = {
        ...message.intervention,
        id: Date.now(),
      };
      setInterventions((prev) => [...prev, intervention]);
      setTimeout(() => {
        setInterventions((prev) => prev.filter((i) => i.id !== intervention.id));
      }, 10000);
    };

    const handleAnswerFeedback = (message) => {
      console.log('Answer feedback:', message);
    };

    const handleAllQuestionsComplete = (message) => {
      console.log('All questions complete:', message);
    };

    const handleSessionComplete = (message) => {
      console.log('Session complete:', message);
      setFinalFeedback(message.feedback);
      setIsSessionComplete(true);
      stopRecording();
      stopListening();
    };

    // Register handlers
    on(WS_MESSAGE_TYPES.AUTH_SUCCESS, handleAuthSuccess);
    on(WS_MESSAGE_TYPES.SESSION_STARTED, handleSessionStarted);
    on(WS_MESSAGE_TYPES.NEXT_QUESTION, handleNextQuestion);
    on(WS_MESSAGE_TYPES.ANALYTICS, handleAnalytics);
    on(WS_MESSAGE_TYPES.INTERVENTION, handleIntervention);
    on(WS_MESSAGE_TYPES.ANSWER_FEEDBACK, handleAnswerFeedback);
    on(WS_MESSAGE_TYPES.ALL_QUESTIONS_COMPLETE, handleAllQuestionsComplete);
    on(WS_MESSAGE_TYPES.SESSION_COMPLETE, handleSessionComplete);

    return () => {
      off(WS_MESSAGE_TYPES.AUTH_SUCCESS);
      off(WS_MESSAGE_TYPES.SESSION_STARTED);
      off(WS_MESSAGE_TYPES.NEXT_QUESTION);
      off(WS_MESSAGE_TYPES.ANALYTICS);
      off(WS_MESSAGE_TYPES.INTERVENTION);
      off(WS_MESSAGE_TYPES.ANSWER_FEEDBACK);
      off(WS_MESSAGE_TYPES.ALL_QUESTIONS_COMPLETE);
      off(WS_MESSAGE_TYPES.SESSION_COMPLETE);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, isSessionStarted, hasPermissions]);

  // Track if we've already tried to auto-start
  const hasAutoStartedRef = useRef(false);

  // Auto-start interview when authenticated and permissions are granted (only once)
  useEffect(() => {
    // Start recording automatically once we have permissions and connection
    if (isConnected && hasPermissions && !isSessionStarted && isInitialized && !hasAutoStartedRef.current) {
      console.log('Auto-starting interview...');
      hasAutoStartedRef.current = true;
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        handleStartInterview();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, hasPermissions, isSessionStarted, isInitialized]);

  // Timer for current question
  useEffect(() => {
    if (isAnswering && answerStartTime) {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - answerStartTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isAnswering, answerStartTime]);

  // Sync speech recognition transcript with answer
  useEffect(() => {
    if (isAnswering && !answerSubmitted) {
      const fullTranscript = getFullTranscript();
      
      // Update answer with transcript (only if we have new content)
      if (fullTranscript && fullTranscript.trim().length > 0) {
        setAnswer(fullTranscript);
      }
      
      // Reset auto-submit timer when user speaks (transcript changes)
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
      
      // Auto-submit after 5 seconds of silence (no new transcript updates)
      // Only if we have a substantial answer (at least 20 characters)
      if (fullTranscript && fullTranscript.trim().length > 20) {
        autoSubmitTimerRef.current = setTimeout(() => {
          if (isAnswering && !answerSubmitted && currentQuestion) {
            console.log('Auto-submitting answer after 5 seconds of silence...');
            handleSubmitAnswer();
          }
        }, 5000); // 5 seconds of silence
      }
    }
    
    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, interimTranscript, isAnswering, answerSubmitted, currentQuestion]);


  /**
   * Start the interview
   */
  const handleStartInterview = () => {
    // Prevent multiple calls
    if (isSessionStarted) {
      console.log('Interview already started');
      return;
    }

    if (!hasPermissions) {
      setError('Please allow camera and microphone access to start the interview.');
      return;
    }

    if (!isConnected) {
      setError('Not connected to server. Please refresh and try again.');
      return;
    }

    // Start recording
    const started = startRecording(
      handleVideoFrame,
      handleAudioChunk,
      VIDEO_SETTINGS.FPS
    );

    if (started) {
      setIsSessionStarted(true);
      
      // Start speech recognition for voice answers (after a small delay)
      if (isSpeechSupported) {
        setTimeout(() => {
          try {
            startListening((finalTranscript) => {
              console.log('Final transcript received:', finalTranscript);
              // Transcript is handled in useEffect
            });
          } catch (error) {
            console.warn('Failed to start speech recognition:', error);
            // Continue without speech recognition - retry after a delay
            setTimeout(() => {
              try {
                startListening((finalTranscript) => {
                  console.log('Final transcript received (retry):', finalTranscript);
                });
              } catch (retryError) {
                console.warn('Failed to start speech recognition on retry:', retryError);
              }
            }, 500);
          }
        }, 200);
      }
    } else {
      setError('Failed to start recording. Please check your camera and microphone.');
    }
  };

  /**
   * Handle video frame capture
   */
  const handleVideoFrame = (frameData) => {
    if (isConnected && isSessionStarted) {
      sendVideoFrame(frameData);
    }
  };

  /**
   * Handle audio chunk
   */
  const handleAudioChunk = (audioData) => {
    if (isConnected && isSessionStarted) {
      // Send audio chunk with transcript from speech recognition
      const currentTranscript = isSpeechSupported ? getFullTranscript() : null;
      sendAudioChunk(audioData, currentTranscript);
    }
  };


  /**
   * Submit current answer
   */
  const handleSubmitAnswer = () => {
    const finalAnswer = answer.trim() || getFullTranscript().trim();
    
    if (!finalAnswer) {
      console.warn('No answer to submit');
      return;
    }

    const duration = (Date.now() - answerStartTime) / 1000;

    // Send answer to backend
    sendAnswer(currentQuestion.question, finalAnswer, duration);
    setAnswerSubmitted(true);

    // Reset for next question
    setIsAnswering(false);
    setAnswerStartTime(null);
    setAnswer('');
    resetTranscript();
    
    // Stop speech recognition temporarily
    if (isListening) {
      stopListening();
    }
    
    // Clear auto-submit timer
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
    }
  };

  /**
   * Skip current question
   */
  const handleSkipQuestion = () => {
    if (!currentQuestion) return;

    // Send a skip marker to backend (empty answer with skipped flag handled server-side)
    try {
      sendAnswer(currentQuestion.question, '', 0);
    } catch (err) {
      console.warn('Failed to send skip:', err);
    }

    setAnswerSubmitted(true);
    setIsAnswering(false);
    setAnswerStartTime(null);
    setAnswer('');
    resetTranscript();

    if (isListening) {
      stopListening();
    }

    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
    }
  };

  /**
   * End session early
   */
  const handleEndSession = () => {
    setShowExitModal(true);
  };

  const confirmEndSession = () => {
    endSession();
    setShowExitModal(false);
  };


  /**
   * Remove intervention
   */
  const handleDismissIntervention = (interventionId) => {
    setInterventions((prev) => prev.filter((i) => i.id !== interventionId));
  };

  // Show session complete screen
  if (isSessionComplete && finalFeedback) {
    return <SessionComplete sessionId={sessionId} feedback={finalFeedback} />;
  }

  // Show loading screen
  if (!isInitialized) {
    return <Loader fullScreen text="Initializing interview session..." />;
  }

  // Show error screen
  if (error || mediaError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-white mb-4">Setup Error</h2>
            <p className="text-gray-300 mb-6">{error || mediaError}</p>
            <div className="space-y-3">
              <Button variant="primary" fullWidth onClick={() => window.location.reload()}>
                Try Again
              </Button>
              <Button variant="ghost" fullWidth onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Full-Screen Video Background */}
      <div className="fixed inset-0 z-0 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{
            transform: 'scaleX(-1)', // Mirror effect for mirror effect
            backgroundColor: '#000000',
            minWidth: '100%',
            minHeight: '100%',
          }}
          onLoadedMetadata={(e) => {
            console.log('Video metadata loaded, playing...');
            const video = e.target;
            video.play().catch(err => {
              console.error('Video autoplay prevented:', err);
              // Try again after user interaction
            });
          }}
          onCanPlay={(e) => {
            console.log('Video can play, ensuring it plays...');
            const video = e.target;
            if (video.paused) {
              video.play().catch(err => {
                console.error('Video play error:', err);
              });
            }
          }}
          onPlay={() => {
            console.log('Video is playing!');
          }}
          onError={(e) => {
            console.error('Video error:', e);
          }}
        />
        
        {/* Camera Off Overlay */}
        {!isCameraEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center text-white">
              <VideoOff size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">Camera is off</p>
            </div>
          </div>
        )}
        
        {/* Dark overlay for better text readability when question is shown */}
        {currentQuestion && !isQuestionMinimized && (
          <div className="absolute inset-0 bg-black/30 z-5"></div>
        )}
      </div>

      {/* Top Bar - Minimal Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-lg font-bold text-white">Interview Session</h1>
                {isConnected ? (
                  <p className="text-xs text-green-400">● Connected</p>
                ) : (
                  <p className="text-xs text-red-400">● Disconnected</p>
                )}
              </div>
              
              {/* Recording Indicator */}
              {isRecording && (
                <div className="flex items-center space-x-2 bg-red-600 text-white px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Recording</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Camera/Mic Status */}
              <div className="flex items-center space-x-2 text-white">
                {isCameraEnabled ? (
                  <Video size={20} className="text-green-400" />
                ) : (
                  <VideoOff size={20} className="text-red-400" />
                )}
                {isMicEnabled ? (
                  <Mic size={20} className="text-green-400" />
                ) : (
                  <MicOff size={20} className="text-red-400" />
                )}
              </div>
              
              {/* Speech Recognition Status */}
              {isSpeechSupported && isListening && (
                <div className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-sm">Listening...</span>
                </div>
              )}
              
              {/* End Session Button */}
              <button
                onClick={handleEndSession}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
              >
                <X size={18} />
                <span>End Session</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Question Overlay */}
      {currentQuestion && (
        <QuestionOverlay
          question={currentQuestion}
          questionNumber={questionNumber}
          totalQuestions={totalQuestions}
          elapsedTime={elapsedTime}
          showHints={true}
          isMinimized={isQuestionMinimized}
          onToggleMinimize={() => setIsQuestionMinimized(!isQuestionMinimized)}
          onSkip={handleSkipQuestion}
          onDone={handleSubmitAnswer}
        />
      )}

      {/* Answer Status Indicator */}
      {isAnswering && currentQuestion && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-black/70 backdrop-blur-sm text-white px-6 py-4 rounded-lg shadow-2xl">
            <div className="flex items-center space-x-4">
              {isSpeechSupported && (
                <div className="flex items-center space-x-2">
                  {isListening ? (
                    <>
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Listening... Speak your answer</span>
                    </>
                  ) : (
                    <>
                      <MicOff size={20} className="text-gray-400" />
                      <span className="text-sm text-gray-400">Not listening</span>
                    </>
                  )}
                </div>
              )}
              
              {answer && answer.trim().length > 0 && (
                <div className="flex items-center space-x-2 text-green-400">
                  <CheckCircle size={20} />
                  <span className="text-sm">Answer recorded ({answer.trim().length} chars)</span>
                </div>
              )}
              
              {answerSubmitted && (
                <div className="flex items-center space-x-2 text-blue-400">
                  <CheckCircle size={20} />
                  <span className="text-sm font-medium">Answer submitted!</span>
                </div>
              )}
            </div>
            
            {/* Show transcript if available */}
            {answer && answer.trim().length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-sm text-gray-300 max-w-2xl">
                  {answer.length > 100 ? `${answer.substring(0, 100)}...` : answer}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls Bar - Bottom Center */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-3 flex items-center space-x-4">
          {/* Camera Toggle */}
          <button
            onClick={() => toggleCamera(!isCameraEnabled)}
            className={`p-3 rounded-full transition-all ${
              isCameraEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          {/* Microphone Toggle */}
          <button
            onClick={() => toggleMicrophone(!isMicEnabled)}
            className={`p-3 rounded-full transition-all ${
              isMicEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          {/* Submit Answer Button (only show when answering) */}
          {isAnswering && currentQuestion && answer.trim().length > 10 && !answerSubmitted && (
            <button
              onClick={handleSubmitAnswer}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full flex items-center space-x-2 transition-all font-medium"
            >
              <CheckCircle size={20} />
              <span>Submit Answer</span>
            </button>
          )}
        </div>
      </div>

      {/* Interventions - Floating Alerts */}
      <div className="fixed top-24 right-4 z-50 space-y-2">
        {interventions.map((intervention) => (
          <InterventionAlert
            key={intervention.id}
            intervention={intervention}
            onDismiss={() => handleDismissIntervention(intervention.id)}
            autoDismiss={8000}
          />
        ))}
      </div>

      {/* Loading State - Only show before session starts */}
      {!isSessionStarted && !currentQuestion && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center">
          <div className="text-center text-white">
            <Loader text="Initializing interview session..." />
            <p className="mt-4 text-gray-300">
              {hasPermissions ? 'Camera and microphone ready' : 'Waiting for camera and microphone permissions...'}
            </p>
            <p className="mt-2 text-gray-400 text-sm">
              {isConnected ? 'Connected to server' : 'Connecting to server...'}
            </p>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      <Modal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        title="End Interview Session?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowExitModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmEndSession}>
              Yes, End Session
            </Button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to end this interview session? Your progress will be saved
          and you'll receive feedback based on the questions you've answered so far.
        </p>
      </Modal>
    </div>
  );
};

export default InterviewSession;