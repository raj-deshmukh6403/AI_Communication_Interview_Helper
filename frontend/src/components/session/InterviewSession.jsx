//https://github.com/copilot/c/ea1f7412-da9c-482d-96dd-0813e96b15bf

/* Full file with targeted changes:
   - adds isEnding state
   - handleSubmitAnswer no longer sets isSessionComplete locally; it calls endSession() and flips isEnding when finishing last question
   - confirmEndSession sets isEnding
   - SESSION_COMPLETE handler clears isEnding and performs cleanup and sets final feedback
*/
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Mic, MicOff, Video, VideoOff, X, CheckCircle } from 'lucide-react';
import useWebSocket from '../../hooks/useWebSocket';
import useMediaRecorder from '../../hooks/useMediaRecorder';
import useSpeechRecognition from '../../hooks/useSpeechRecognition';
import useTextToSpeech from '../../hooks/useTextToSpeech';
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

  const { isSupported: isTtsSupported, speak: speakQuestion } = useTextToSpeech();

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
  
  //right now new code
  const [liveWarnings, setLiveWarnings] = useState([]);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  // NEW: isEnding indicates we've requested the server to end the session and are waiting for confirmation
  const [isEnding, setIsEnding] = useState(false);

  // Live analytics from backend (video + audio)
  const [liveAnalytics, setLiveAnalytics] = useState({
    video: null,
    audio: null,
    lastUpdated: null,
  });

  const autoSubmitTimerRef = useRef(null);
  const videoFrameIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const hasAutoStartedRef = useRef(false);
  const isStartingRef = useRef(false);
  // right now new code
  const frameCounterRef = useRef(0);
  // end of right now new code

  useEffect(() => {
    const init = async () => {
      try {
        setError(null);
        console.log('🚀 Starting initialization...');
        
        await requestPermissions();
        console.log('✅ Media permissions granted');
        
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
      //right now new code
      setIsGeneratingFeedback(false);
      setAnswerFeedback(null);

      // Read the question aloud using browser TTS (if available)
      try {
        const qText = message.question?.question || '';
        if (isTtsSupported && qText) {
          speakQuestion(qText, { rate: 1, pitch: 1 });
        }
      } catch (e) {
        console.warn('TTS question read failed:', e);
      }
      
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

    const handleAnalytics = (message) => {
      // Server sends: { type: 'analytics', data: { video?, audio?, timestamp } }
      const data = message.data || {};
      setLiveAnalytics((prev) => ({
        video: data.video || prev.video,
        audio: data.audio || prev.audio,
        lastUpdated: data.timestamp || new Date().toISOString(),
      }));

      //right now new code
      const warnings = message?.data?.video?.warnings || [];
      if (warnings.length > 0) {
        setLiveWarnings(warnings);
        setTimeout(() => setLiveWarnings([]), 4000);
      }
    };

    // IMPORTANT: SESSION_COMPLETE is authoritative - when server sends it we finalize on client
    const handleSessionComplete = (message) => {
      console.log('✅ Session complete (server):', message);
      setFinalFeedback(message.feedback || null);

      // Stop recording and speech recognition once server declares session complete
      try { stopRecording(); } catch (e) { console.warn('stopRecording error', e); }
      try { stopListening(); } catch (e) { console.warn('stopListening error', e); }

      // Clear any timers
      if (videoFrameIntervalRef.current) clearInterval(videoFrameIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);

      // Clear ending flag and mark session complete
      setIsEnding(false);
      setIsSessionComplete(true);
    };

    //right now new code
    const handleAnswerFeedback = (message) => {
      setAnswerFeedback({
        score: message.score,
        preScore: message.pre_score,
        feedback: message.feedback,
        action: message.action,
      });
      setTimeout(() => setAnswerFeedback(null), 5000);
    };

    const handleAllQuestionsComplete = (message) => {
      setIsGeneratingFeedback(true);
    };

    //

    on(WS_MESSAGE_TYPES.AUTH_SUCCESS, handleAuthSuccess);
    on(WS_MESSAGE_TYPES.SESSION_STARTED, handleSessionStarted);
    on(WS_MESSAGE_TYPES.NEXT_QUESTION, handleNextQuestion);
    on(WS_MESSAGE_TYPES.INTERVENTION, handleIntervention);
    //on(WS_MESSAGE_TYPES.ANALYTICS, handleAnalytics);
    on(WS_MESSAGE_TYPES.SESSION_COMPLETE, handleSessionComplete);
    //right now new code
    on(WS_MESSAGE_TYPES.ANALYTICS, handleAnalytics);
    on(WS_MESSAGE_TYPES.ANSWER_FEEDBACK, handleAnswerFeedback);
    on(WS_MESSAGE_TYPES.ALL_QUESTIONS_COMPLETE, handleAllQuestionsComplete);

    return () => {
      off(WS_MESSAGE_TYPES.AUTH_SUCCESS);
      off(WS_MESSAGE_TYPES.SESSION_STARTED);
      off(WS_MESSAGE_TYPES.NEXT_QUESTION);
      off(WS_MESSAGE_TYPES.INTERVENTION);
      //off(WS_MESSAGE_TYPES.ANALYTICS);
      off(WS_MESSAGE_TYPES.SESSION_COMPLETE);

      //right now new code
      off(WS_MESSAGE_TYPES.ANALYTICS);
      off(WS_MESSAGE_TYPES.ANSWER_FEEDBACK);
      off(WS_MESSAGE_TYPES.ALL_QUESTIONS_COMPLETE);
    };
  }, [isConnected, isSessionStarted, isSpeechSupported, isListening,]);

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
            console.log('🎤 Starting speech recognition...');
            startListening((finalTranscript) => {
              console.log('📝 Speech final:', finalTranscript);
            });
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
    // if (isConnected && isSessionStarted) {
    //   sendVideoFrame(frameData);
    // }
    //right now new code
    frameCounterRef.current += 1;
    if (frameCounterRef.current % 3 !== 0) return;  // send every 3rd frame only
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

  /**
   * Submit answer.
   * If force === true, submit even when answer is short/empty (user clicked "Done").
   *
   * NOTE: When the last question is answered we send END_SESSION and set isEnding=true.
   * We do NOT mark the session complete locally — we wait for the server's SESSION_COMPLETE.
   */
  const handleSubmitAnswer = (force = false) => {
    const finalAnswer = answer.trim() || getFullTranscript().trim();
    
    if (!finalAnswer && !force) {
      console.warn('⚠️ Answer too short or empty, not submitting');
      return;
    }

    if (!currentQuestion) {
      console.warn('⚠️ No current question');
      return;
    }

    console.log('📤 Submitting answer:', (finalAnswer || '[empty]').substring(0, 50) + '...');

    const duration = answerStartTime ? ((Date.now() - answerStartTime) / 1000) : 0;
    try {
      sendAnswer(currentQuestion.question, finalAnswer, duration);
    } catch (err) {
      console.warn('Failed to send answer:', err);
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

    console.log('✅ Answer submitted successfully');

    // If this was the last question, instruct server to finalize session and enter "ending" state.
    // IMPORTANT: do not set isSessionComplete locally here; wait for server SESSION_COMPLETE.
    if (questionNumber && totalQuestions && questionNumber >= totalQuestions) {
      console.log('🏁 Last question answered - requesting server to end session');
      try {
        endSession();            // send END_SESSION to server
        setIsEnding(true);       // show "ending" UI while we wait for server confirmation
      } catch (err) {
        console.warn('Failed to send endSession message:', err);
        // If sending fails, fallback to local cleanup (but still indicate we couldn't notify server)
        stopRecording();
        stopListening();
        setIsEnding(false);
        setIsSessionComplete(true);
      }
    }
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
    // User explicitly confirmed end - ask server to end session and show "ending" UI
    try {
      endSession();
      setIsEnding(true);
    } catch (err) {
      console.warn('Failed to send endSession on confirm:', err);
      // fallback: do local cleanup
      stopRecording();
      stopListening();
      setIsSessionComplete(true);
    }
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

  // Optional: show a small "ending..." overlay while waiting for server confirmation
  const EndingOverlay = () => (
    <div className="fixed inset-0 z-60 flex items-center justify-center pointer-events-none">
      <div className="bg-black/60 backdrop-blur-sm text-white px-6 py-3 rounded-lg shadow-2xl pointer-events-auto">
        <div className="flex items-center space-x-3">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
          <span className="text-sm font-medium">Ending session — waiting for server...</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {isEnding && <EndingOverlay />}

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

        {/* right now new code */}

        {/* Live warnings overlay */}
        {liveWarnings.length > 0 && (
          <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-20 space-y-1">
            {liveWarnings.map((warning, i) => (
              <div key={i} className="bg-yellow-500/90 text-black text-sm font-semibold px-4 py-2 rounded-lg shadow-lg text-center">
                ⚠️ {warning}
              </div>
            ))}
          </div>
        )}

        {/* Answer feedback toast */}
        {answerFeedback && (
          <div className="absolute top-24 right-4 z-50 bg-black/80 text-white rounded-lg p-4 shadow-xl w-72">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-lg">Answer Score</span>
              <span className={`text-2xl font-bold ${answerFeedback.score >= 70 ? 'text-green-400' : answerFeedback.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {Math.round(answerFeedback.score || 0)}
              </span>
            </div>
            {answerFeedback.preScore && (
              <p className="text-xs text-gray-400 mb-1">Pre-score: {Math.round(answerFeedback.preScore)}</p>
            )}
            {answerFeedback.feedback && (
              <p className="text-sm text-gray-300">{answerFeedback.feedback}</p>
            )}
            {answerFeedback.action === 'follow_up' && (
              <p className="text-xs text-blue-400 mt-2">📌 Follow-up question coming...</p>
            )}
          </div>
        )}

        {/* Generating feedback loading state */}
        {isGeneratingFeedback && (
          <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-xl font-semibold">Generating your feedback report...</p>
              <p className="text-gray-400 mt-2">Analysing all your responses</p>
            </div>
          </div>
        )}
        {/* End of right now new code */}

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

      {/* Live analytics overlay (eye contact, engagement, audio metrics) */}
      {(liveAnalytics.video || liveAnalytics.audio) && (
        <div className="fixed bottom-6 left-6 z-40">
          <div className="bg-black/70 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl text-xs min-w-[220px]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">Live Analysis</span>
              <span className="text-[10px] text-gray-400">
                {liveAnalytics.lastUpdated
                  ? new Date(liveAnalytics.lastUpdated).toLocaleTimeString()
                  : ''}
              </span>
            </div>

            {liveAnalytics.video && (
              <div className="mb-2 border-b border-white/10 pb-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Eye contact</span>
                  <span className="font-semibold">
                    {Math.round(liveAnalytics.video.eye_contact_score || 0)}%
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                  <span>Engagement</span>
                  <span>
                    {liveAnalytics.video.engagement_score != null
                      ? Math.round(liveAnalytics.video.engagement_score)
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                  <span>Emotion</span>
                  <span className="capitalize">
                    {liveAnalytics.video.dominant_emotion || 'neutral'}
                  </span>
                </div>
              </div>
            )}

            {liveAnalytics.audio && (
              <div>
                <div className="flex justify-between text-[11px] text-gray-300">
                  <span>Speaking pace</span>
                  <span>
                    {liveAnalytics.audio.speaking_pace
                      ? `${Math.round(liveAnalytics.audio.speaking_pace)} wpm`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-300 mt-1">
                  <span>Volume</span>
                  <span>
                    {liveAnalytics.audio.volume_level != null
                      ? `${Math.round(liveAnalytics.audio.volume_level)}/100`
                      : '—'}
                  </span>
                </div>
                {liveAnalytics.audio.filler_words_count != null && (
                  <div className="flex justify-between text-[11px] text-gray-300 mt-1">
                    <span>Filler words</span>
                    <span>{liveAnalytics.audio.filler_words_count}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {currentQuestion && (
        <QuestionOverlay
          question={currentQuestion}
          questionNumber={questionNumber}
          totalQuestions={totalQuestions}
          elapsedTime={elapsedTime}
          showHints={true}
          isMinimized={isQuestionMinimized}
          //right now new code
          isFollowUp={currentQuestion?.type === 'follow_up'}   
          //end of right now new code
          onToggleMinimize={() => setIsQuestionMinimized(!isQuestionMinimized)}
          onSkip={handleSkipQuestion}
          onDone={() => handleSubmitAnswer(true)}
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
              onClick={() => handleSubmitAnswer(false)}
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