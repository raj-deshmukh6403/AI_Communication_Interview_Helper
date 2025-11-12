import { WS_URL, WS_MESSAGE_TYPES, STORAGE_KEYS } from '../utils/constants';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.messageHandlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.isIntentionallyClosed = false;
    this.heartbeatInterval = null;
  }

  /**
   * Connect to WebSocket server
   */
  connect(sessionId, onOpen, onError) {
    return new Promise((resolve, reject) => {
      this.sessionId = sessionId;
      this.isIntentionallyClosed = false;
      
      const wsUrl = `${WS_URL}/ws/interview/${sessionId}`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          
          // Small delay to ensure connection is fully ready
          setTimeout(() => {
            // Authenticate with JWT token
            this.authenticate();
            
            // Start heartbeat
            this.startHeartbeat();
            
            if (onOpen) onOpen();
            resolve();
          }, 100);
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (onError) onError(error);
        };
        
        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.stopHeartbeat();
          
          // Attempt to reconnect if not intentionally closed
          if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect(onOpen, onError);
          }
        };
        
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Authenticate with server
   */
  authenticate() {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    
    if (!token) {
      console.error('No auth token found');
      return;
    }
    
    // Add a small delay to ensure WebSocket is fully ready
    // Also retry if not connected yet
    const tryAuthenticate = () => {
      if (this.isConnected()) {
        try {
          this.send({
            type: WS_MESSAGE_TYPES.AUTH,
            token: token,
          });
          console.log('Authentication message sent');
        } catch (error) {
          console.error('Error sending auth message:', error);
          // Retry after a short delay
          setTimeout(tryAuthenticate, 100);
        }
      } else {
        // WebSocket not ready yet, retry after a short delay
        setTimeout(tryAuthenticate, 100);
      }
    };
    
    // Try immediately, then retry if needed
    tryAuthenticate();
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({
          type: WS_MESSAGE_TYPES.PING,
          timestamp: Date.now(),
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect(onOpen, onError) {
    this.reconnectAttempts++;
    
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );
    
    setTimeout(() => {
      this.connect(this.sessionId, onOpen, onError);
    }, this.reconnectDelay);
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      const messageType = message.type;
      
      // Call registered handler for this message type
      if (this.messageHandlers[messageType]) {
        this.messageHandlers[messageType](message);
      }
      
      // Also call global handler if exists
      if (this.messageHandlers['*']) {
        this.messageHandlers['*'](message);
      }
      
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  /**
   * Register message handler
   */
  on(messageType, handler) {
    this.messageHandlers[messageType] = handler;
  }

  /**
   * Unregister message handler
   */
  off(messageType) {
    delete this.messageHandlers[messageType];
  }

  /**
   * Send message to server
   */
  send(message) {
    if (this.isConnected()) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('WebSocket not connected. Message not sent:', message);
      return false;
    }
  }

  /**
   * Send video frame
   */
  sendVideoFrame(frameData) {
    this.send({
      type: WS_MESSAGE_TYPES.VIDEO_FRAME,
      data: frameData,
      timestamp: Date.now(),
    });
  }

  /**
   * Send audio chunk
   */
  sendAudioChunk(audioData, transcript = null) {
    this.send({
      type: WS_MESSAGE_TYPES.AUDIO_CHUNK,
      data: audioData,
      transcript: transcript,
      timestamp: Date.now(),
    });
  }

  /**
   * Send answer
   */
  sendAnswer(question, answer, duration) {
    this.send({
      type: WS_MESSAGE_TYPES.ANSWER,
      question: question,
      answer: answer,
      duration: duration,
      request_followup: false, // Can be made dynamic
    });
  }

  /**
   * End session
   */
  endSession() {
    this.send({
      type: WS_MESSAGE_TYPES.END_SESSION,
    });
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Close WebSocket connection
   */
  close() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client closing connection');
      this.ws = null;
    }
    
    // Clear all handlers
    this.messageHandlers = {};
  }

  /**
   * Get connection state
   */
  getReadyState() {
    if (!this.ws) return 'CLOSED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;