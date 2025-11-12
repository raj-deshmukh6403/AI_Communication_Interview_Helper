import { VIDEO_SETTINGS, AUDIO_SETTINGS } from '../utils/constants';

class MediaService {
  constructor() {
    this.stream = null;
    this.videoTrack = null;
    this.audioTrack = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  

  // Expose instance for debugging from the console: window.__mediaService
    try {
      // set on window when possible so you can inspect in browser console
      // Example: window.__mediaService.getStream()
      if (typeof window !== 'undefined') {
        window.__mediaService = this;
      }
    } catch (e) {
      // ignore in non-browser environments
    }
  }

   /**
   * Set stream (called from useMediaRecorder)
   */
  setStream(stream) {
    this.stream = stream;
    if (stream) {
      this.videoTrack = stream.getVideoTracks()[0] || null;
      this.audioTrack = stream.getAudioTracks()[0] || null;
      console.log('✅ MediaService: Stream set', {
        hasVideo: !!this.videoTrack,
        hasAudio: !!this.audioTrack,
        videoTracks: stream.getVideoTracks().map(t => ({ id: t.id, enabled: t.enabled })),
        audioTracks: stream.getAudioTracks().map(t => ({ id: t.id, enabled: t.enabled })),
      });
    } else {
      this.videoTrack = null;
      this.audioTrack = null;
    }

    // keep window.__mediaService pointing to this instance
    try {
      if (typeof window !== 'undefined') window.__mediaService = this;
    } catch (e) { /* ignore */ }
  }


  /**
   * Request camera and microphone permissions
   */
  async requestPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: VIDEO_SETTINGS.WIDTH },
          height: { ideal: VIDEO_SETTINGS.HEIGHT },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: AUDIO_SETTINGS.SAMPLE_RATE,
        },
      });
      
      this.setStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error(this.getMediaErrorMessage(error));
    }
  }

  /**
   * Get human-readable error message
   */
  getMediaErrorMessage(error) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Camera and microphone access denied. Please allow permissions and try again.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No camera or microphone found. Please connect devices and try again.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'Camera or microphone is already in use by another application.';
    } else if (error.name === 'OverconstrainedError') {
      return 'Camera or microphone does not meet requirements.';
    } else {
      return 'Could not access camera or microphone. Please try again.';
    }
  }

  /**
   * Capture video frame as base64
   */
  captureFrame(videoElement) {
    if (!videoElement) {
      throw new Error('Video element not provided');
    }
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = VIDEO_SETTINGS.WIDTH;
      canvas.height = VIDEO_SETTINGS.HEIGHT;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', VIDEO_SETTINGS.QUALITY);
      
      return dataUrl;
    } catch (error) {
      console.error('Error capturing frame:', error);
      return null;
    }
  }

  /**
   * 🔥 FIX: Start audio recording (removed stream check, use this.audioTrack)
   */
  startAudioRecording(onDataAvailable) {
    if (!this.audioTrack) {
      console.warn('⚠️ No audio track available, attempting to get it from stream');
      
      // Try to get audio track from stream
      if (this.stream) {
        this.audioTrack = this.stream.getAudioTracks()[0];
      }
      
      if (!this.audioTrack) {
        console.error('❌ No audio track found');
        throw new Error('Media stream not initialized - no audio track');
      }
    }
    
    try {
      // Create MediaRecorder with audio track only
      const audioStream = new MediaStream([this.audioTrack]);
      
      this.mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: this.getSupportedMimeType(),
      });
      
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          
          // Convert to base64 and call callback
          const blob = new Blob([event.data], { type: event.data.type });
          this.blobToBase64(blob).then((base64) => {
            if (onDataAvailable) {
              onDataAvailable(base64);
            }
          });
        }
      };
      
      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
      };
      
      // Start recording with chunks every N seconds
      this.mediaRecorder.start(AUDIO_SETTINGS.CHUNK_DURATION);
      console.log('✅ Audio recording started');
      
      return true;
    } catch (error) {
      console.error('Error starting audio recording:', error);
      throw error;
    }
  }

  /**
   * Stop audio recording
   */
  stopAudioRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
      console.log('✅ Audio recording stopped');
    }
  }

  /**
   * Get supported MIME type for MediaRecorder
   */
  getSupportedMimeType() {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    
    return ''; // Let browser choose default
  }

  /**
   * Convert Blob to base64
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get full audio recording as blob
   */
  getAudioBlob() {
    if (this.audioChunks.length === 0) {
      return null;
    }
    
    return new Blob(this.audioChunks, { type: AUDIO_SETTINGS.MIME_TYPE });
  }

  /**
   * Download audio recording
   */
  downloadAudio(filename = 'recording.webm') {
    const blob = this.getAudioBlob();
    
    if (!blob) {
      console.warn('No audio data to download');
      return;
    }
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Check if media devices are available
   */
  async checkDeviceAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      const hasAudio = devices.some(device => device.kind === 'audioinput');
      
      return {
        hasVideo,
        hasAudio,
        devices,
      };
    } catch (error) {
      console.error('Error checking devices:', error);
      return {
        hasVideo: false,
        hasAudio: false,
        devices: [],
      };
    }
  }

  /**
   * Get list of available cameras
   */
  async getCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error getting cameras:', error);
      return [];
    }
  }

  /**
   * Get list of available microphones
   */
  async getMicrophones() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting microphones:', error);
      return [];
    }
  }

  /**
   * Switch camera
   */
  async switchCamera(deviceId) {
    try {
      // Stop current stream
      this.stopStream();
      
      // Request new stream with specific device
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: VIDEO_SETTINGS.WIDTH },
          height: { ideal: VIDEO_SETTINGS.HEIGHT },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: AUDIO_SETTINGS.SAMPLE_RATE,
        },
      });
      
      this.setStream(stream);
      return stream;
    } catch (error) {
      console.error('Error switching camera:', error);
      throw error;
    }
  }

  /**
   * Mute/unmute microphone
   */
  toggleMicrophone(enabled) {
    if (this.audioTrack) {
      this.audioTrack.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Enable/disable camera
   */
  toggleCamera(enabled) {
    if (this.videoTrack) {
      this.videoTrack.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Get current stream
   */
  getStream() {
    return this.stream;
  }

  /**
   * Check if camera is enabled
   */
  isCameraEnabled() {
    return this.videoTrack ? this.videoTrack.enabled : false;
  }

  /**
   * Check if microphone is enabled
   */
  isMicrophoneEnabled() {
    return this.audioTrack ? this.audioTrack.enabled : false;
  }

  /**
   * Stop media stream
   */
  stopStream() {
    // Stop recording if active
    this.stopAudioRecording();
    
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.videoTrack = null;
    this.audioTrack = null;
    this.audioChunks = [];
  }

  /**
   * Take screenshot
   */
  takeScreenshot(videoElement, filename = 'screenshot.jpg') {
    const dataUrl = this.captureFrame(videoElement);
    
    if (!dataUrl) {
      console.warn('Failed to capture screenshot');
      return;
    }
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Check browser support for required features
   */
  static checkBrowserSupport() {
    return {
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mediaRecorder: 'MediaRecorder' in window,
      webRTC: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection),
      webSocket: 'WebSocket' in window,
    };
  }

  /**
   * Get browser support status message
   */
  static getSupportMessage() {
    const support = MediaService.checkBrowserSupport();
    
    if (!support.getUserMedia) {
      return 'Your browser does not support camera/microphone access. Please use a modern browser.';
    }
    
    if (!support.mediaRecorder) {
      return 'Your browser does not support audio recording. Please use a modern browser.';
    }
    
    if (!support.webSocket) {
      return 'Your browser does not support WebSocket connections. Please use a modern browser.';
    }
    
    return 'All features are supported!';
  }
}

// Create singleton instance
const mediaService = new MediaService();

export default mediaService;