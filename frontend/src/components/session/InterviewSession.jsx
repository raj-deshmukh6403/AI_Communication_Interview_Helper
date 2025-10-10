import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Mic, MicOff, Send, SkipForward, X } from 'lucide-react';
import useWebSocket from '../../hooks/useWebSocket';
import useMediaRecorder from '../../hooks/useMediaRecorder';
import useSpeechRecognition from '../../hooks/useSpeechRecognition';
import VideoDisplay from './VideoDisplay';
import QuestionDisplay from './QuestionDisplay';
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
    takeScreenshot,
  } = useMediaRecorder();

  // Speech recognition
  const {
    isSupported: isSpeechSupported,
    isListening,
    transcript,
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

  // Refs
  const videoFrameIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const lastTranscriptRef = useRef('');

  // Initialize session
  useEffect(() => {
    initializeSession();

    return () => {
      cleanup();
    };
  }, [sessionId]);

  // Setup WebSocket message handlers
  useEffect(() => {
    if (!isConnected) return;

    // Authentication success
    on(WS_MESSAGE_TYPES.AUTH_SUCCESS, handleAuthSuccess);

    // Session started
    on(WS_MESSAGE_TYPES.SESSION_STARTED, handleSessionStarted);

    // Next question
    on(WS_MESSAGE_TYPES.NEXT_QUESTION, handleNextQuestion);

    // Real-time analytics
    on(WS_MESSAGE_TYPES.ANALYTICS, handleAnalytics);

    // Intervention/feedback
    on(WS_MESSAGE_TYPES.INTERVENTION, handleIntervention);

    // Answer feedback
    on(WS_MESSAGE_TYPES.ANSWER_FEEDBACK, handleAnswerFeedback);

    // All questions complete
    on(WS_MESSAGE_TYPES.ALL_QUESTIONS_COMPLETE, handleAllQuestionsComplete);

    // Session complete
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
  }, [isConnected]);

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

  // Sync speech recognition with answer
  useEffect(() => {
    if (transcript && transcript !== lastTranscriptRef.current) {
      setAnswer(transcript);
      lastTranscriptRef.current = transcript;
    }
  }, [transcript]);

  /**
   * Initialize session - request permissions and connect WebSocket
   */
  const initializeSession = async () => {
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

  /**
   * Start the interview
   */
  const handleStartInterview = () => {
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
      
      // Start speech recognition if supported
      if (isSpeechSupported) {
        startListening((finalTranscript) => {
          // Optional: handle final transcript
          console.log('Final transcript:', finalTranscript);
        });
      }
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
      const currentTranscript = isSpeechSupported ? getFullTranscript() : null;
      sendAudioChunk(audioData, currentTranscript);
    }
  };

  /**
   * WebSocket message handlers
   */
  const handleAuthSuccess = (message) => {
    console.log('Authenticated:', message);
  };

  const handleSessionStarted = (message) => {
    console.log('Session started:', message);
    setTotalQuestions(message.total_questions || 5);
  };

  const handleNextQuestion = (message) => {
    console.log('Next question:', message);
    setCurrentQuestion(message.question);
    setQuestionNumber(message.question_number);
    setAnswer('');
    resetTranscript();
    setIsAnswering(true);
    setAnswerStartTime(Date.now());
    setElapsedTime(0);
  };

  const handleAnalytics = (message) => {
    // Real-time analytics received (can be displayed if needed)
    console.log('Analytics:', message);
  };

  const handleIntervention = (message) => {
    console.log('Intervention:', message);
    
    // Add intervention to list
    const intervention = {
      ...message.intervention,
      id: Date.now(),
    };
    
    setInterventions((prev) => [...prev, intervention]);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      setInterventions((prev) => prev.filter((i) => i.id !== intervention.id));
    }, 10000);
  };

  const handleAnswerFeedback = (message) => {
    console.log('Answer feedback:', message);
    // Could show immediate feedback here if desired
  };

  const handleAllQuestionsComplete = (message) => {
    console.log('All questions complete:', message);
    // Show message that feedback is being generated
  };

  const handleSessionComplete = (message) => {
    console.log('Session complete:', message);
    setFinalFeedback(message.feedback);
    setIsSessionComplete(true);
    
    // Stop everything
    stopRecording();
    if (isListening) stopListening();
  };

  /**
   * Submit current answer
   */
  const handleSubmitAnswer = () => {
    if (!answer.trim()) {
      alert('Please provide an answer before submitting.');
      return;
    }

    const duration = (Date.now() - answerStartTime) / 1000;

    // Send answer to backend
    sendAnswer(currentQuestion.question, answer, duration);

    // Reset for next question
    setIsAnswering(false);
    setAnswerStartTime(null);
    setAnswer('');
    resetTranscript();
  };

  /**
   * Skip current question
   */
  const handleSkipQuestion = () => {
    if (window.confirm('Are you sure you want to skip this question?')) {
      const duration = (Date.now() - answerStartTime) / 1000;
      sendAnswer(currentQuestion.question, 'Skipped', duration);
      
      setIsAnswering(false);
      setAnswerStartTime(null);
      setAnswer('');
      resetTranscript();
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
   * Cleanup on unmount
   */
  const cleanup = () => {
    stopRecording();
    if (isListening) stopListening();
    disconnect();
    
    if (videoFrameIntervalRef.current) {
      clearInterval(videoFrameIntervalRef.current);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-600 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Setup Error</h2>
            <p className="text-gray-600 mb-6">{error || mediaError}</p>
            <div className="space-y-3">
              <Button variant="primary" fullWidth onClick={initializeSession}>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Interview Session</h1>
              {isConnected ? (
                <p className="text-sm text-green-600">● Connected</p>
              ) : (
                <p className="text-sm text-red-600">● Disconnected</p>
              )}
            </div>
            <Button variant="danger" onClick={handleEndSession} icon={<X size={18} />}>
              End Session
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {!isSessionStarted ? (
          /* Pre-Interview Setup */
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Start?</h2>
              <p className="text-gray-600 mb-6">
                Make sure your camera and microphone are working properly. You'll be asked
                a series of interview questions. Take your time and answer naturally.
              </p>

              {/* Video Preview */}
              <div className="mb-6">
                <VideoDisplay
                  videoRef={videoRef}
                  isRecording={false}
                  isCameraEnabled={isCameraEnabled}
                  isMicEnabled={isMicEnabled}
                  onToggleCamera={() => toggleCamera(!isCameraEnabled)}
                  onToggleMic={() => toggleMicrophone(!isMicEnabled)}
                  onTakeScreenshot={takeScreenshot}
                />
              </div>

              {/* Checklist */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-3">Before you start:</h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>Find a quiet place with good lighting</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>Position yourself centered in the frame</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>Speak clearly and maintain eye contact with camera</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>Take your time - there's no rush!</span>
                  </li>
                </ul>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleStartInterview}
                disabled={!hasPermissions || !isConnected}
              >
                Start Interview
              </Button>
            </div>
          </div>
        ) : (
          /* During Interview */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Video */}
            <div className="lg:col-span-1">
              <VideoDisplay
                videoRef={videoRef}
                isRecording={isRecording}
                isCameraEnabled={isCameraEnabled}
                isMicEnabled={isMicEnabled}
                onToggleCamera={() => toggleCamera(!isCameraEnabled)}
                onToggleMic={() => toggleMicrophone(!isMicEnabled)}
                onTakeScreenshot={takeScreenshot}
              />

              {/* Interventions */}
              <div className="mt-4 space-y-2">
                {interventions.map((intervention) => (
                  <InterventionAlert
                    key={intervention.id}
                    intervention={intervention}
                    onDismiss={() => handleDismissIntervention(intervention.id)}
                    autoDismiss={8000}
                  />
                ))}
              </div>
            </div>

            {/* Right Column - Question & Answer */}
            <div className="lg:col-span-2 space-y-6">
              {/* Question Display */}
              {currentQuestion && (
                <QuestionDisplay
                  question={currentQuestion}
                  questionNumber={questionNumber}
                  totalQuestions={totalQuestions}
                  elapsedTime={elapsedTime}
                  showHints={true}
                />
              )}

              {/* Answer Input */}
              {isAnswering && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Your Answer</h3>
                    {isSpeechSupported && (
                      <div className="flex items-center space-x-2">
                        {isListening ? (
                          <div className="flex items-center text-red-600">
                            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse mr-2"></div>
                            <Mic size={18} />
                            <span className="text-sm ml-1">Listening...</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <MicOff size={18} />
                            <span className="text-sm ml-1">Not listening</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Answer Textarea */}
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Speak your answer or type here..."
                    className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />

                  <p className="text-xs text-gray-500 mt-2">
                    {isSpeechSupported
                      ? 'Your speech is being transcribed automatically. You can also type or edit.'
                      : 'Type your answer here.'}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 mt-6">
                    <Button
                      variant="ghost"
                      onClick={handleSkipQuestion}
                      icon={<SkipForward size={18} />}
                    >
                      Skip
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSubmitAnswer}
                      disabled={!answer.trim()}
                      icon={<Send size={18} />}
                    >
                      Submit Answer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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