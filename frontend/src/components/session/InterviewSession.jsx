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

const InterviewSession = ({ sessionId }) => {
  const navigate = useNavigate();

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

  // --- added helper: wait for the videoRef to be mounted before requesting permissions ---
  const waitForVideoRef = async (timeout = 3000) => {
    const start = Date.now();
    while (!videoRef.current && Date.now() - start < timeout) {
      // small pause, waiting for the video element to mount
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
    return !!videoRef.current;
  };

  const [isInitialized, setIsInitialized] = useState(false);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(15);
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
  
  const autoSubmitTimerRef = useRef(null);
  const videoFrameIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const hasAutoStartedRef = useRef(false);
  const isStartingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        setError(null);
        console.log('🚀 Starting initialization...');

        // Wait for video element to mount so we can attach stream immediately
        const ready = await waitForVideoRef(3000);
        if (!ready) {
          console.warn('⚠️ videoRef not ready after wait — proceeding but stream attach will be attempted in hook');
        } else {
          console.log('✅ videoRef ready - proceeding to request permissions');
        }

        const mediaStream = await requestPermissions();
        console.log('✅ Media permissions granted (InterviewSession)', mediaStream);
        
        // SAFETY: attach stream directly to the component video element if available
        if (mediaStream && videoRef && videoRef.current) {
          try {
            console.log('🔗 Attaching returned MediaStream to videoRef in InterviewSession...');
            const v = videoRef.current;
            v.muted = true;
            v.playsInline = true;
            v.autoplay = true;
            v.srcObject = mediaStream;
            v.play().then(() => console.log('✅ Interview video play() succeeded')).catch(err => {
              console.warn('⚠️ Interview video play() blocked or failed:', err && err.message ? err.message : err);
            });
          } catch (attachErr) {
            console.warn('⚠️ Failed to attach stream to videoRef in InterviewSession:', attachErr);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        
        await connect();
        console.log('✅ WebSocket connected');
        
        setIsInitialized(true);
      } catch (err) {
        console.error('❌ Initialization error:', err);
        setError(getErrorMessage(err));
      }
    };

    init();

    return () => {
      console.log('🧹 Cleanup: Stopping all services');
      stopRecording();
      stopListening();
      disconnect();
      
      if (videoFrameIntervalRef.current) {
        clearInterval(videoFrameIntervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (!isConnected) return;

    const handleAuthSuccess = (message) => {
      console.log('✅ Authenticated:', message);
    };

    const handleSessionStarted = (message) => {
      console.log('✅ Session started:', message);
      setTotalQuestions(message.total_questions || 15);
    };

    const handleNextQuestion = (message) => {
      console.log('📝 Next question:', message);
      setCurrentQuestion(message.question);
      setQuestionNumber(message.question_number);
      setAnswer('');
      setAnswerSubmitted(false);
      resetTranscript();
      setIsAnswering(true);
      setAnswerStartTime(Date.now());
      setElapsedTime(0);
      setIsQuestionMinimized(false);
      
      if (isListening) {
        console.log('🛑 Stopping previous speech recognition...');
        stopListening();
      }
      
      if (isSpeechSupported && isSessionStarted) {
        setTimeout(() => {
          try {
            console.log('🎤 Starting speech recognition for new question...');
            startListening((finalTranscript) => {
              console.log('📝 Final transcript:', finalTranscript);
            });
          } catch (error) {
            console.warn('⚠️ Failed to start speech:', error);
            setTimeout(() => {
              try {
                console.log('🔄 Retrying speech recognition...');
                startListening((finalTranscript) => {
                  console.log('📝 Final transcript (retry):', finalTranscript);
                });
              } catch (retryError) {
                console.error('❌ Speech retry failed:', retryError);
              }
            }, 1000);
          }
        }, 800);
      }
    };

    const handleIntervention = (message) => {
      console.log('⚠️ Intervention:', message);
      const intervention = {
        ...message.intervention,
        id: Date.now(),
      };
      setInterventions((prev) => [...prev, intervention]);
      setTimeout(() => {
        setInterventions((prev) => prev.filter((i) => i.id !== intervention.id));
      }, 10000);
    };

    const handleSessionComplete = (message) => {
      console.log('✅ Session complete:', message);
      setFinalFeedback(message.feedback);
      setIsSessionComplete(true);
      stopRecording();
      stopListening();
    };

    on(WS_MESSAGE_TYPES.AUTH_SUCCESS, handleAuthSuccess);
    on(WS_MESSAGE_TYPES.SESSION_STARTED, handleSessionStarted);
    on(WS_MESSAGE_TYPES.NEXT_QUESTION, handleNextQuestion);
    on(WS_MESSAGE_TYPES.INTERVENTION, handleIntervention);
    on(WS_MESSAGE_TYPES.SESSION_COMPLETE, handleSessionComplete);

    return () => {
      off(WS_MESSAGE_TYPES.AUTH_SUCCESS);
      off(WS_MESSAGE_TYPES.SESSION_STARTED);
      off(WS_MESSAGE_TYPES.NEXT_QUESTION);
      off(WS_MESSAGE_TYPES.INTERVENTION);
      off(WS_MESSAGE_TYPES.SESSION_COMPLETE);
    };
  }, [isConnected, isSessionStarted, isSpeechSupported, isListening]);

  useEffect(() => {
    if (isConnected && 
        hasPermissions && 
        !isSessionStarted && 
        isInitialized && 
        !hasAutoStartedRef.current && 
        !isStartingRef.current) {
      
      console.log('🎬 Auto-starting interview...');
      hasAutoStartedRef.current = true;
      isStartingRef.current = true;
      
      setTimeout(() => {
        handleStartInterview();
        isStartingRef.current = false;
      }, 1000);
    }
  }, [isConnected, hasPermissions, isSessionStarted, isInitialized]);

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

  useEffect(() => {
    if (isAnswering && !answerSubmitted) {
      const fullTranscript = getFullTranscript();
      
      if (fullTranscript && fullTranscript.trim().length > 0) {
        setAnswer(fullTranscript);
      }
      
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
      
      if (fullTranscript && fullTranscript.trim().length > 30) {
        autoSubmitTimerRef.current = setTimeout(() => {
          if (isAnswering && !answerSubmitted && currentQuestion) {
            console.log('⏱️ Auto-submitting after 5s silence...');
            handleSubmitAnswer();
          }
        }, 5000);
      }
    }
    
    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
    };
  }, [transcript, interimTranscript, isAnswering, answerSubmitted, currentQuestion]);

  const handleStartInterview = () => {
    if (isSessionStarted) {
      console.log('⚠️ Interview already started');
      return;
    }

    if (!hasPermissions) {
      setError('Please allow camera and microphone access.');
      return;
    }

    if (!isConnected) {
      setError('Not connected to server. Please refresh.');
      return;
    }

    console.log('🎬 Starting interview recording...');

    const started = startRecording(
      handleVideoFrame,
      handleAudioChunk,
      VIDEO_SETTINGS.FPS
    );

    if (started) {
      console.log('✅ Recording started successfully');
      setIsSessionStarted(true);
      
      if (isSpeechSupported) {
        setTimeout(() => {
          try {
            console.log('🎤 Attempting to start speech recognition...');
            const startedSpeech = startListening((finalTranscript) => {
              console.log('📝 Speech final:', finalTranscript);
            });
            if (!startedSpeech) {
              console.warn('⚠️ startListening returned false — speech recognition did not start');
            }
          } catch (error) {
            console.warn('⚠️ Speech start failed:', error);
          }
        }, 500);
      }
    } else {
      console.error('❌ Failed to start recording');
      setError('Failed to start recording. Please check permissions.');
    }
  };

  const handleVideoFrame = (frameData) => {
    if (isConnected && isSessionStarted) {
      sendVideoFrame(frameData);
    }
  };

  const handleAudioChunk = (audioData) => {
    if (isConnected && isSessionStarted) {
      const currentTranscript = isSpeechSupported ? getFullTranscript() : null;
      sendAudioChunk(audioData, currentTranscript);
    }
  };

  const handleSubmitAnswer = () => {
    const finalAnswer = answer.trim() || getFullTranscript().trim();
    
    if (!finalAnswer || finalAnswer.length < 10) {
      console.warn('⚠️ Answer too short or empty');
      return;
    }

    if (!currentQuestion) {
      console.warn('⚠️ No current question');
      return;
    }

    console.log('📤 Submitting answer:', finalAnswer.substring(0, 50) + '...');

    const duration = (Date.now() - answerStartTime) / 1000;
    sendAnswer(currentQuestion.question, finalAnswer, duration);
    
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

    console.log('✅ Answer submitted successfully');
  };

  const handleSkipQuestion = () => {
    if (!currentQuestion) return;

    console.log('⏭️ Skipping question');
    
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

  const handleEndSession = () => {
    setShowExitModal(true);
  };

  const confirmEndSession = () => {
    endSession();
    setShowExitModal(false);
  };

  const handleDismissIntervention = (interventionId) => {
    setInterventions((prev) => prev.filter((i) => i.id !== interventionId));
  };

  if (isSessionComplete && finalFeedback) {
    return <SessionComplete sessionId={sessionId} feedback={finalFeedback} />;
  }

  if (!isInitialized) {
    return <Loader fullScreen text="Initializing interview session..." />;
  }

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
      <div className="fixed inset-0 z-0 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{
            transform: 'scaleX(-1)',
            backgroundColor: '#000000',
          }}
        />
        
        {!isCameraEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center text-white">
              <VideoOff size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">Camera is off</p>
            </div>
          </div>
        )}
        
        {currentQuestion && !isQuestionMinimized && (
          <div className="absolute inset-0 bg-black/30 z-5"></div>
        )}
      </div>

      <div className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-lg font-bold text-white">Interview Session</h1>
                <p className="text-xs text-green-400">● {isConnected ? 'Connected' : 'Disconnected'}</p>
              </div>
              
              {isRecording && (
                <div className="flex items-center space-x-2 bg-red-600 text-white px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Recording</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
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
              
              {isSpeechSupported && isListening && (
                <div className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-sm">Listening...</span>
                </div>
              )}
              
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
            </div>
            
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

      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-3 flex items-center space-x-4">
          <button
            onClick={() => toggleCamera(!isCameraEnabled)}
            className={`p-3 rounded-full transition-all ${
              isCameraEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button
            onClick={() => toggleMicrophone(!isMicEnabled)}
            className={`p-3 rounded-full transition-all ${
              isMicEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          {isAnswering && currentQuestion && answer.trim().length > 20 && !answerSubmitted && (
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

      {isAnswering && !answerSubmitted && (transcript || interimTranscript) && (
        <div className="fixed bottom-24 right-6 z-50 w-96">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Your Answer</span>
              </div>
              <span className="text-xs text-gray-400">
                {(transcript + ' ' + interimTranscript).trim().split(/\s+/).filter(w => w).length} words
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto text-sm leading-relaxed">
              <p>
                {transcript}
                {interimTranscript && (
                  <span className="text-gray-400 italic"> {interimTranscript}</span>
                )}
              </p>
            </div>
            {transcript.trim().length > 30 && (
              <div className="mt-2 pt-2 border-t border-white/20 text-xs text-gray-300">
                💡 Will auto-submit after 5 seconds of silence
              </div>
            )}
          </div>
        </div>
      )}

      {!isSessionStarted && !currentQuestion && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center">
          <div className="text-center text-white">
            <Loader text="Initializing interview session..." />
            <p className="mt-4 text-gray-300">
              {hasPermissions ? 'Camera and microphone ready ✅' : 'Waiting for permissions...'}
            </p>
            <p className="mt-2 text-gray-400 text-sm">
              {isConnected ? 'Connected to server ✅' : 'Connecting...'}
            </p>
          </div>
        </div>
      )}

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
          Are you sure you want to end this interview session? Your progress will be saved.
        </p>
      </Modal>
    </div>
  );
};

export default InterviewSession;