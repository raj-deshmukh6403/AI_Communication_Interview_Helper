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
        console.log('Setting video srcObject...');
        videoRef.current.srcObject = mediaStream;
        
        // Ensure video plays - wait for metadata
        const video = videoRef.current;
        const playVideo = () => {
          video.play()
            .then(() => {
              console.log('Video started playing');
            })
            .catch(err => {
              console.error('Video autoplay prevented:', err);
              // Try again after user interaction or delay
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.play().catch(e => {
                    console.error('Retry video play failed:', e);
                  });
                }
              }, 500);
            });
        };
        
        // Wait for video to be ready
        if (video.readyState >= 2) {
          playVideo();
        } else {
          video.addEventListener('loadedmetadata', playVideo, { once: true });
          video.addEventListener('canplay', playVideo, { once: true });
        }
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
      console.log('Attaching stream to video element...');
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready, then play
      const video = videoRef.current;
      
      const tryPlay = () => {
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA
          video.play()
            .then(() => {
              console.log('Video playing successfully');
            })
            .catch(err => {
              console.error('Video play error:', err);
              // Retry after a short delay
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.play().catch(e => {
                    console.error('Failed to play video on retry:', e);
                  });
                }
              }, 500);
            });
        } else {
          // Wait for video to be ready
          video.addEventListener('loadedmetadata', tryPlay, { once: true });
          video.addEventListener('canplay', tryPlay, { once: true });
        }
      };
      
      // Try immediately if ready, otherwise wait for events
      if (video.readyState >= 2) {
        tryPlay();
      } else {
        video.addEventListener('loadedmetadata', tryPlay, { once: true });
        video.addEventListener('canplay', tryPlay, { once: true });
      }
      
      // Also try after a delay as fallback
      setTimeout(() => {
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(err => {
            console.log('Delayed video play attempt:', err);
          });
        }
      }, 1000);
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