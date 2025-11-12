import React from 'react';
import { Video, VideoOff, Mic, MicOff, Camera } from 'lucide-react';

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
    <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-xl w-full" style={{ minHeight: '400px', aspectRatio: '16/9' }}>
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ 
          width: '100%',
          height: '100%',
          minHeight: '400px',
          transform: 'scaleX(-1)', // Mirror effect
          backgroundColor: '#111827' // Dark background when no video
        }}
        onLoadedMetadata={(e) => {
          // Ensure video plays
          e.target.play().catch(err => {
            console.log('Video autoplay prevented:', err);
          });
        }}
      />

      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-1.5 rounded-full z-10">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Recording</span>
        </div>
      )}

      {/* Camera Off Overlay */}
      {!isCameraEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="text-center text-white">
            <VideoOff size={64} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">Camera is off</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-3 z-10">
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
        <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1.5 rounded-full flex items-center space-x-2 z-10">
          <MicOff size={16} />
          <span className="text-sm">Muted</span>
        </div>
      )}
    </div>
  );
};

export default VideoDisplay;