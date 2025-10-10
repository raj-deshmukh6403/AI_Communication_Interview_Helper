import { useState, useEffect, useCallback, useRef } from 'react';
import mediaService from '../services/mediaService';

/**
 * Custom hook for media recording (camera and microphone)
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

  /**
   * Request camera and microphone permissions
   */
  const requestPermissions = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await mediaService.requestPermissions();
      setStream(mediaStream);
      setHasPermissions(true);
      
      // Attach stream to video element if ref exists
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      return mediaStream;
    } catch (err) {
      setError(err.message);
      setHasPermissions(false);
      throw err;
    }
  }, []);

  /**
   * Start recording video and audio
   */
  const startRecording = useCallback((onVideoFrame, onAudioChunk, fps = 2) => {
    if (!stream) {
      setError('Media stream not initialized');
      return false;
    }

    try {
      setIsRecording(true);
      
      // Start capturing video frames
      if (onVideoFrame) {
        const frameInterval = 1000 / fps; // Convert FPS to milliseconds
        
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
        audioCallbackRef.current = onAudioChunk;
        mediaService.startAudioRecording(onAudioChunk);
      }
      
      return true;
    } catch (err) {
      setError(err.message);
      setIsRecording(false);
      return false;
    }
  }, [stream, isCameraEnabled]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    // Stop video frame capture
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    // Stop audio recording
    mediaService.stopAudioRecording();
    audioCallbackRef.current = null;
    
    setIsRecording(false);
  }, []);

  /**
   * Toggle camera on/off
   */
  const toggleCamera = useCallback((enabled) => {
    const success = mediaService.toggleCamera(enabled);
    if (success) {
      setIsCameraEnabled(enabled);
    }
    return success;
  }, []);

  /**
   * Toggle microphone on/off
   */
  const toggleMicrophone = useCallback((enabled) => {
    const success = mediaService.toggleMicrophone(enabled);
    if (success) {
      setIsMicEnabled(enabled);
    }
    return success;
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
      stopRecording();
      mediaService.stopStream();
    };
  }, [stopRecording]);

  /**
   * Update video element when stream changes
   */
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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