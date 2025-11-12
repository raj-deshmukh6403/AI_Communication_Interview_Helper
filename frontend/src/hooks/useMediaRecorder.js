import { useState, useEffect, useCallback, useRef } from 'react';
import mediaService from '../services/mediaService';

/**
 * FIXED: Custom hook for media recording (camera and microphone)
 */
const useMediaRecorder = () => {
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [error, setError] = useState(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  
  const videoRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const audioCallbackRef = useRef(null);
  const streamRef = useRef(null);

  /**
   * Request camera and microphone permissions
   */
  const requestPermissions = useCallback(async () => {
    try {
      setError(null);
      console.log('🎥 Requesting media permissions...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ Media stream obtained:', mediaStream);
      console.log('📹 Video tracks:', mediaStream.getVideoTracks());
      console.log('🎤 Audio tracks:', mediaStream.getAudioTracks());
      
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermissions(true);
      
      // Pass stream to mediaService
      mediaService.setStream(mediaStream);
      
      return mediaStream;
    } catch (err) {
      console.error('❌ Error accessing media devices:', err);
      let errorMessage = 'Could not access camera/microphone. ';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow camera and microphone permissions in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found on your device.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Camera/microphone is already in use by another application.';
      } else {
        errorMessage += err.message;
      }
      
      setError(errorMessage);
      setHasPermissions(false);
      throw err;
    }
  }, []);

  /**
   * 🔥 FIX: Attach stream to video element and force play
   */
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log('🔗 Attaching stream to video element...');
      
      const video = videoRef.current;
      video.srcObject = stream;
      
      // Force attributes
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      
      // Aggressive play attempts
      const tryPlay = () => {
        if (video.paused) {
          video.play()
            .then(() => console.log('✅ Video playing'))
            .catch(err => console.warn('⚠️ Play blocked:', err.message));
        }
      };
      
      // Try multiple times
      setTimeout(tryPlay, 100);
      setTimeout(tryPlay, 500);
      setTimeout(tryPlay, 1000);
      
      // Event listeners
      video.addEventListener('loadedmetadata', tryPlay);
      video.addEventListener('canplay', tryPlay);
      
      return () => {
        video.removeEventListener('loadedmetadata', tryPlay);
        video.removeEventListener('canplay', tryPlay);
      };
    }
  }, [stream]);

  /**
   * Start recording video and audio
   */
  const startRecording = useCallback((onVideoFrame, onAudioChunk, fps = 2) => {
    console.log('🎬 Starting recording...');
    
    if (!streamRef.current) {
      console.error('❌ No stream available');
      setError('Media stream not initialized');
      return false;
    }

    try {
      setIsRecording(true);
      console.log('✅ Recording started');
      
      // Start capturing video frames
      if (onVideoFrame) {
        const frameInterval = 1000 / fps;
        console.log(`📸 Capturing frames every ${frameInterval}ms (${fps} FPS)`);
        
        frameIntervalRef.current = setInterval(() => {
          if (videoRef.current && isCameraEnabled) {
            const frameData = mediaService.captureFrame(videoRef.current);
            if (frameData) {
              onVideoFrame(frameData);
            }
          }
        }, frameInterval);
      }
      
      // Start recording audio
      if (onAudioChunk) {
        console.log('🎤 Starting audio recording...');
        audioCallbackRef.current = onAudioChunk;
        mediaService.startAudioRecording(onAudioChunk);
      }
      
      return true;
    } catch (err) {
      console.error('❌ Error starting recording:', err);
      setError(err.message);
      setIsRecording(false);
      return false;
    }
  }, [isCameraEnabled]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    console.log('⏹️ Stopping recording...');
    
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    mediaService.stopAudioRecording();
    audioCallbackRef.current = null;
    
    setIsRecording(false);
    console.log('✅ Recording stopped');
  }, []);

  /**
   * Toggle camera on/off
   */
  const toggleCamera = useCallback((enabled) => {
    console.log(`📹 Toggle camera: ${enabled}`);
    
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
        setIsCameraEnabled(enabled);
        console.log(`✅ Camera ${enabled ? 'enabled' : 'disabled'}`);
        return true;
      }
    }
    console.warn('⚠️ No video track found');
    return false;
  }, []);

  /**
   * Toggle microphone on/off
   */
  const toggleMicrophone = useCallback((enabled) => {
    console.log(`🎤 Toggle microphone: ${enabled}`);
    
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
        setIsMicEnabled(enabled);
        console.log(`✅ Microphone ${enabled ? 'enabled' : 'disabled'}`);
        return true;
      }
    }
    console.warn('⚠️ No audio track found');
    return false;
  }, []);

  /**
   * Capture single frame
   */
  const captureFrame = useCallback(() => {
    if (videoRef.current) {
      return mediaService.captureFrame(videoRef.current);
    }
    return null;
  }, []);

  /**
   * Take screenshot
   */
  const takeScreenshot = useCallback((filename) => {
    if (videoRef.current) {
      mediaService.takeScreenshot(videoRef.current, filename);
    }
  }, []);

  /**
   * Check device availability
   */
  const checkDevices = useCallback(async () => {
    try {
      const availability = await mediaService.checkDeviceAvailability();
      return availability;
    } catch (err) {
      console.error('Error checking devices:', err);
      return { hasVideo: false, hasAudio: false, devices: [] };
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up media recorder...');
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`⏹️ Stopped track: ${track.kind}`);
        });
      }
    };
  }, [stopRecording]);

  return {
    videoRef,
    stream,
    isRecording,
    isCameraEnabled,
    isMicEnabled,
    hasPermissions,
    error,
    requestPermissions,
    startRecording,
    stopRecording,
    toggleCamera,
    toggleMicrophone,
    captureFrame,
    takeScreenshot,
    checkDevices,
  };
};

export default useMediaRecorder;