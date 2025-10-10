import React from 'react';
import { Video, VideoOff, Mic, MicOff, Camera } from 'lucide-react';
import Button from '../common/Button';

/**
 * Video Display Component - Shows user's camera feed with controls
 */
const VideoDisplay = ({
  videoRef,
  isRecording,
  isCameraEnabled,
  isMicEnabled,
  onToggleCamera,
  onToggleMic,
  onTakeScreenshot,
}) => {
  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-xl">
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover video-mirror"
        style={{ maxHeight: '480px' }}
      />

      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-1.5 rounded-full">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Recording</span>
        </div>
      )}

      {/* Camera Off Overlay */}
      {!isCameraEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center text-white">
            <VideoOff size={64} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">Camera is off</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-3">
        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`p-3 rounded-full transition-all ${
            isCameraEnabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        {/* Microphone Toggle */}
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-full transition-all ${
            isMicEnabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* Screenshot Button */}
        {onTakeScreenshot && (
          <button
            onClick={onTakeScreenshot}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all"
            title="Take screenshot"
          >
            <Camera size={20} />
          </button>
        )}
      </div>

      {/* Microphone Muted Indicator */}
      {!isMicEnabled && (
        <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1.5 rounded-full flex items-center space-x-2">
          <MicOff size={16} />
          <span className="text-sm">Muted</span>
        </div>
      )}
    </div>
  );
};

export default VideoDisplay;