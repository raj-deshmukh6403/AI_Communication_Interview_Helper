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
  const attachCheckIntervalRef = useRef(null);

  // Guard so we don't call getUserMedia concurrently
  const isRequestingRef = useRef(false);

  /**
   * Utility sleep
   */
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  /**
   * Request camera and microphone permissions with retries and fallback constraints
   */
  const requestPermissions = useCallback(async () => {
    // Prevent concurrent calls
    if (isRequestingRef.current) {
      console.log('🎥 requestPermissions already in progress - returning existing state');
      // If a stream is already set, just return it
      if (streamRef.current) return streamRef.current;
      // otherwise wait briefly and proceed to attempt
      await sleep(200);
    }

    isRequestingRef.current = true;
    setError(null);

    const preferredConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
        frameRate: { ideal: 30 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    };

    const fallbackConstraints = {
      video: true,
      audio: true,
    };

    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        console.log(`🎥 Requesting media permissions (attempt ${attempt}/${maxAttempts})...`);
        const constraints = attempt === 1 ? preferredConstraints : fallbackConstraints;

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        console.log('✅ Media stream obtained:', mediaStream);
        console.log('📹 Video tracks:', mediaStream.getVideoTracks());
        console.log('🎤 Audio tracks:', mediaStream.getAudioTracks());

        streamRef.current = mediaStream;
        setStream(mediaStream);
        setHasPermissions(true);
        
        // Pass stream to mediaService
        try {
          mediaService.setStream(mediaStream);
        } catch (e) {
          console.warn('⚠️ mediaService.setStream failed:', e);
        }

        isRequestingRef.current = false;
        return mediaStream;
      } catch (err) {
        lastError = err;
        console.error(`❌ Error accessing media devices (attempt ${attempt}):`, err);

        // If it's an abort/time-out or device busy, wait and retry with fallback constraints
        const retryable = (
          err?.name === 'AbortError' ||
          err?.name === 'NotReadableError' ||
          err?.name === 'TrackStartError' ||
          err?.name === 'OverconstrainedError' ||
          err?.name === 'NotAllowedError' // permission denied - not really retryable but we'll surface
        );

        // If permission explicitly denied, break immediately (do not retry)
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          setError('Please allow camera and microphone permissions in your browser settings.');
          isRequestingRef.current = false;
          setHasPermissions(false);
          throw err;
        }

        // If not retryable (unknown), break
        if (!retryable) {
          console.warn('🔴 Non-retryable error when requesting media:', err);
          isRequestingRef.current = false;
          setHasPermissions(false);
          throw err;
        }

        // If this was the last attempt, throw
        if (attempt === maxAttempts) {
          isRequestingRef.current = false;
          setHasPermissions(false);
          const msg = err?.message || 'Could not access camera/microphone. Please try again.';
          setError(msg);
          throw err;
        }

        // Wait a bit before retrying to allow device to become available
        const backoffMs = attempt === 1 ? 600 : 1000;
        console.log(`⏳ Waiting ${backoffMs}ms before retrying getUserMedia...`);
        await sleep(backoffMs);
        // continue loop - next attempts will use fallback constraints
      }
    }

    // If we reached here, we failed
    isRequestingRef.current = false;
    setHasPermissions(false);
    const finalMsg = lastError ? (lastError.message || String(lastError)) : 'Unknown error';
    setError(finalMsg);
    throw lastError || new Error('Failed to get media');
  }, []);

  /**
   * Keep stream attached even if <video> mounts late or rerenders.
   */
  useEffect(() => {
    if (!stream) return undefined;

    let cancelled = false;

    const attachAndPlay = () => {
      if (cancelled) return false;
      const video = videoRef.current;
      if (!video) return false;

      if (video.srcObject !== stream) {
        console.log('🔗 Attaching stream to video element...');
        video.srcObject = stream;
      }

      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;

      if (video.paused) {
        video.play().catch((err) => {
          console.warn('⚠️ Play blocked:', err && err.message ? err.message : err);
        });
      }

      return true;
    };

    // Immediate attach attempt
    attachAndPlay();

    // Persistent safety-net for delayed refs/rerenders
    if (attachCheckIntervalRef.current) {
      clearInterval(attachCheckIntervalRef.current);
    }
    attachCheckIntervalRef.current = setInterval(() => {
      attachAndPlay();
    }, 400);

    return () => {
      cancelled = true;
      if (attachCheckIntervalRef.current) {
        clearInterval(attachCheckIntervalRef.current);
        attachCheckIntervalRef.current = null;
      }
    };
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
      if (attachCheckIntervalRef.current) {
        clearInterval(attachCheckIntervalRef.current);
        attachCheckIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`⏹️ Stopped track: ${track.kind}`);
        });
        streamRef.current = null;
      }
      // remove video srcObject to release resource
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = null;
        } catch (e) {}
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

