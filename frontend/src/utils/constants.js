// API Configuration
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  ME: '/auth/me',
  CHANGE_PASSWORD: '/auth/change-password',
  
  // Sessions
  SESSIONS: '/sessions',
  CREATE_SESSION: '/sessions/create',
  SESSION_DETAIL: (id) => `/sessions/${id}`,
  DELETE_SESSION: (id) => `/sessions/${id}`,
  COMPARE_SESSIONS: '/sessions/compare',
  PROGRESS_STATS: '/sessions/statistics/progress',
  
  // Analytics
  SESSION_ANALYTICS: (id) => `/analytics/${id}`,
  USER_SUMMARY: '/analytics/user/summary',
  USER_TRENDS: '/analytics/user/trends',
  WEAK_AREAS: '/analytics/user/weak-areas',
  
  // WebSocket
  WS_INTERVIEW: (id) => `/ws/interview/${id}`,
};

// WebSocket Message Types
export const WS_MESSAGE_TYPES = {
  // Client to Server
  AUTH: 'auth',
  VIDEO_FRAME: 'video_frame',
  AUDIO_CHUNK: 'audio_chunk',
  ANSWER: 'answer',
  END_SESSION: 'end_session',
  PING: 'ping',
  
  // Server to Client
  AUTH_SUCCESS: 'auth_success',
  SESSION_STARTED: 'session_started',
  NEXT_QUESTION: 'next_question',
  ANALYTICS: 'analytics',
  INTERVENTION: 'intervention',
  ANSWER_FEEDBACK: 'answer_feedback',
  ALL_QUESTIONS_COMPLETE: 'all_questions_complete',
  SESSION_COMPLETE: 'session_complete',
  PONG: 'pong',
  HEARTBEAT: 'heartbeat',
};

// Video Settings
export const VIDEO_SETTINGS = {
  WIDTH: 640,
  HEIGHT: 480,
  FPS: parseInt(process.env.REACT_APP_VIDEO_FPS) || 2, // Frames per second to send
  QUALITY: 0.7, // JPEG quality
};

// Audio Settings
export const AUDIO_SETTINGS = {
  SAMPLE_RATE: 16000,
  CHUNK_DURATION: parseInt(process.env.REACT_APP_AUDIO_CHUNK_DURATION) || 3000, // ms
  MIME_TYPE: 'audio/webm;codecs=opus',
};

// Speech Recognition Settings
export const SPEECH_SETTINGS = {
  ENABLED: process.env.REACT_APP_ENABLE_SPEECH_RECOGNITION === 'true',
  LANGUAGE: 'en-US',
  CONTINUOUS: true,
  INTERIM_RESULTS: true,
};

// Session Status
export const SESSION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ABORTED: 'aborted',
};

// Question Types
export const QUESTION_TYPES = {
  BEHAVIORAL: 'behavioral',
  TECHNICAL: 'technical',
  COMMUNICATION: 'communication',
};

// Difficulty Levels
export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

// Score Thresholds
export const SCORE_THRESHOLDS = {
  EXCELLENT: 85,
  GOOD: 70,
  FAIR: 55,
  NEEDS_IMPROVEMENT: 0,
};

// Intervention Severity
export const INTERVENTION_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Chart Colors
export const CHART_COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',
  info: '#06b6d4',
  purple: '#a855f7',
};

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  LAST_SESSION: 'last_session',
  SETTINGS: 'app_settings',
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  AUTH_ERROR: 'Authentication failed. Please login again.',
  SESSION_ERROR: 'Failed to load session. Please try again.',
  CAMERA_ERROR: 'Could not access camera. Please check permissions.',
  MICROPHONE_ERROR: 'Could not access microphone. Please check permissions.',
  WEBSOCKET_ERROR: 'Connection lost. Please refresh the page.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  SESSION_CREATED: 'Session created successfully!',
  SESSION_COMPLETED: 'Interview completed! Check your feedback.',
  PROFILE_UPDATED: 'Profile updated successfully!',
  PASSWORD_CHANGED: 'Password changed successfully!',
};

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  JOB_DESCRIPTION_MIN_LENGTH: 50,
  POSITION_MIN_LENGTH: 2,
};

// File Upload Settings
export const FILE_UPLOAD = {
  MAX_SIZE_MB: 5,
  ALLOWED_TYPES: ['.pdf', '.docx', '.doc'],
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
};

// Pagination
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  DEFAULT_SKIP: 0,
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_WITH_TIME: 'MMM DD, YYYY HH:mm',
  API: 'YYYY-MM-DD',
};

// Feature Flags
export const FEATURES = {
  ENABLE_VIDEO_ANALYSIS: process.env.REACT_APP_ENABLE_VIDEO_ANALYSIS !== 'false',
  ENABLE_SPEECH_RECOGNITION: process.env.REACT_APP_ENABLE_SPEECH_RECOGNITION !== 'false',
  ENABLE_ANALYTICS: process.env.REACT_APP_ENABLE_ANALYTICS !== 'false',
};