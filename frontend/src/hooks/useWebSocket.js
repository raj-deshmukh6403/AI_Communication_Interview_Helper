import { useState, useEffect, useCallback, useRef } from 'react';
import websocketService from '../services/websocketService';
import { WS_MESSAGE_TYPES } from '../utils/constants';

/**
 * Custom hook for WebSocket connection
 */
const useWebSocket = (sessionId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('CLOSED');
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const handlersRef = useRef({});

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (!sessionId) {
      setError('Session ID is required');
      return;
    }

    try {
      await websocketService.connect(
        sessionId,
        () => {
          setIsConnected(true);
          setConnectionState('OPEN');
          setError(null);
        },
        (err) => {
          setError(err.message || 'WebSocket connection failed');
          setIsConnected(false);
        }
      );
    } catch (err) {
      setError(err.message || 'Failed to connect');
      setIsConnected(false);
    }
  }, [sessionId]);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    websocketService.close();
    setIsConnected(false);
    setConnectionState('CLOSED');
  }, []);

  /**
   * Register message handler
   */
  const on = useCallback((messageType, handler) => {
    handlersRef.current[messageType] = handler;
    websocketService.on(messageType, handler);
  }, []);

  /**
   * Unregister message handler
   */
  const off = useCallback((messageType) => {
    delete handlersRef.current[messageType];
    websocketService.off(messageType);
  }, []);

  /**
   * Send video frame
   */
  const sendVideoFrame = useCallback((frameData) => {
    websocketService.sendVideoFrame(frameData);
  }, []);

  /**
   * Send audio chunk
   */
  const sendAudioChunk = useCallback((audioData, transcript = null) => {
    websocketService.sendAudioChunk(audioData, transcript);
  }, []);

  /**
   * Send answer
   */
  const sendAnswer = useCallback((question, answer, duration) => {
    websocketService.sendAnswer(question, answer, duration);
  }, []);

  /**
   * End session
   */
  const endSession = useCallback(() => {
    websocketService.endSession();
  }, []);

  /**
   * Send custom message
   */
  const send = useCallback((message) => {
    websocketService.send(message);
  }, []);

  /**
   * Update connection state periodically
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const state = websocketService.getReadyState();
      setConnectionState(state);
      setIsConnected(state === 'OPEN');
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Unregister all handlers
      Object.keys(handlersRef.current).forEach((messageType) => {
        websocketService.off(messageType);
      });
    };
  }, []);

  return {
    isConnected,
    connectionState,
    error,
    messages,
    connect,
    disconnect,
    on,
    off,
    sendVideoFrame,
    sendAudioChunk,
    sendAnswer,
    endSession,
    send,
  };
};

export default useWebSocket;