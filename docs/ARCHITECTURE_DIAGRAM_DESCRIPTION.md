# AI Interview Coach - Architecture Diagram Description

## PROJECT OVERVIEW
Real-time AI-powered interview practice platform that analyzes candidate's video and audio during mock interviews, provides real-time interventions, and generates comprehensive performance reports.

---

## SYSTEM ARCHITECTURE LAYERS

### 1. PRESENTATION LAYER (Frontend)
**Technology**: React 19.2.0, Tailwind CSS, WebSocket Client
**Components**:
- **Auth Components**: LoginForm, RegisterForm (one-time activity)
- **Session Components**: CreateSession (job description textbox + resume upload), InterviewSession (main interview interface with video feed), SessionComplete (report card display)
- **Analytics Components**: AnalyticsCharts, FeedbackReport, SessionDetail, CompareSession
- **Common Components**: Navbar, Dashboard, ProtectedRoute
- **Custom Hooks**: useWebSocket (WebSocket management), useMediaRecorder (camera/mic access), useSpeechRecognition (live transcription), useTextToSpeech

### 2. APPLICATION LAYER (Backend)
**Technology**: FastAPI 0.104.1 (async Python), Uvicorn (ASGI server), WebSocket Server
**Routers**:
- **auth.py**: POST /auth/register, POST /auth/login → JWT token generation
- **sessions.py**: POST /api/sessions/create (receives job_description + resume file), GET /api/sessions, GET /api/sessions/{id}
- **websocket.py**: ws://backend/ws/interview/{session_id} → handles real-time video/audio streams
- **analytics.py**: GET /api/analytics (performance metrics, session comparisons)

**Services**:
- **llm_service.py**: Groq API integration with Llama 3.1 8B model → question generation from resume + job description, feedback text generation
- **video_analyzer.py**: MediaPipe Face Mesh (468 landmarks) → eye contact, head pose, facial movements | DeepFace → emotion detection (7 emotions)
- **audio_analyzer.py**: librosa → volume, pitch, speaking rate analysis | Regex → filler word detection (um, uh, like, you know) | Whisper → speech-to-text backup
- **real_time_monitor.py**: Tracks issue counters (looking_down, poor_eye_contact, speaking_too_fast) → triggers interventions when thresholds exceeded → 15-second cooldown mechanism
- **feedback_generator.py**: Aggregates all session data → calculates scores (communication 30%, confidence 30%, content 40%) → identifies strengths & improvements → generates final report

### 3. DATA LAYER
**Technology**: MongoDB (NoSQL document database), Motor (async driver)
**Collections**:
- **users**: {_id, email (unique indexed), hashed_password (bcrypt), full_name, created_at, sessions_count}
- **sessions**: {_id, user_id (FK indexed), job_description, company_name, position, status (pending/in_progress/completed/aborted), generated_questions[], responses[{question, answer, timestamp, duration_seconds, video_analytics{}, audio_analytics{}, real_time_feedback[]}], overall_score, feedback{communication_score, confidence_score, content_quality_score, strengths[], improvements[], detailed_feedback, recommendations[]}}

**Relationship**: One User → Many Sessions (1:N)

---

## COMPLETE USER FLOW (FOR DIAGRAM)

### PHASE 0: ONE-TIME AUTHENTICATION
```
User → Frontend (LoginForm/RegisterForm)
Frontend → Backend API (POST /auth/register or /auth/login)
Backend → MongoDB (insert/verify user, bcrypt password hashing)
Backend → Frontend (JWT token)
Frontend → localStorage (store token for subsequent requests)
```

### PHASE 1: SESSION CREATION & QUESTION GENERATION
```
User → Frontend (CreateSession: enters job description in textbox + uploads resume file)
Frontend → Backend API (POST /api/sessions/create with FormData: job_description + resume file)
Backend → Resume Parser (extracts text from PDF/DOCX)
Backend → MongoDB (create session document: status=pending, job_description, resume_text)
Backend → LLM Service (sends resume_text + job_description to Groq Llama 3.1 8B)
LLM Service → Groq API (prompt: "Generate behavioral/technical/communication interview questions based on resume and job description")
Groq API → LLM Service (returns JSON array of questions)
LLM Service → Backend (questions array)
Backend → MongoDB (store questions in session.generated_questions[])
Backend → Frontend (session_id)
Frontend → Navigation (redirect to /interview/{session_id})
```

### PHASE 2: INTERVIEW SESSION - REAL-TIME ANALYSIS
```
Frontend → WebSocket Connection (ws://backend/ws/interview/{session_id})
Frontend → Backend (auth message with JWT token)
Backend → MongoDB (fetch session, retrieve generated_questions[])
Backend → Frontend (first question via "next_question" WebSocket message)
Frontend → User (displays question on screen via QuestionDisplay component)

User → Browser (grants camera & microphone permissions)
Frontend → MediaRecorder (starts capturing video stream)
Frontend → SpeechRecognition API (starts live transcription)

[REAL-TIME STREAMING LOOP - Repeats every 2-3 seconds]:
  Frontend → Canvas (captures video frame from videoRef)
  Frontend → Base64 Encoder (converts frame to base64 JPEG)
  Frontend → WebSocket ("video_frame" message with base64 data)
  WebSocket → Backend (receives video frame)
  Backend → ThreadPoolExecutor (offloads to prevent blocking)
  ThreadPoolExecutor → VideoAnalyzer (decode base64 → OpenCV → BGR to RGB conversion)
  VideoAnalyzer → MediaPipe Face Mesh (detects 468 facial landmarks)
  MediaPipe → VideoAnalyzer (returns eye landmarks, nose tip, mouth corners)
  VideoAnalyzer → Calculations (eye gaze vector, head pitch/yaw, eye aspect ratio, head movement from previous frame)
  VideoAnalyzer → DeepFace (cropped face → emotion detection)
  DeepFace → VideoAnalyzer (returns 7 emotion probabilities: angry, disgust, fear, happy, sad, surprise, neutral)
  VideoAnalyzer → VideoAnalyzer (computes engagement score = eye_contact(40%) + head_position(30%) + emotion(20%) + stability(10%))
  VideoAnalyzer → Backend (returns video_analytics: eye_contact_score, dominant_emotion, head_position, engagement_score)

  Frontend → WebSocket ("audio_chunk" message with base64 audio + live transcript)
  WebSocket → Backend (receives audio chunk)
  Backend → ThreadPoolExecutor (offloads analysis)
  ThreadPoolExecutor → AudioAnalyzer (decode base64 → librosa.load at 16kHz)
  AudioAnalyzer → librosa.feature.rms (calculates volume RMS energy)
  AudioAnalyzer → librosa.piptrack (extracts pitch in Hz)
  AudioAnalyzer → Word Counter (counts words in transcript / duration → calculates WPM)
  AudioAnalyzer → Regex Matcher (searches for filler words: um, uh, like, you know)
  AudioAnalyzer → AudioAnalyzer (computes volume consistency, pitch variation)
  AudioAnalyzer → Backend (returns audio_analytics: volume, pitch, speaking_pace_wpm, filler_words_count)

  Backend → RealTimeMonitor (receives video_analytics + audio_analytics)
  RealTimeMonitor → Issue Counters (increments counters for detected issues: looking_down, poor_eye_contact, speaking_too_fast, excessive_movement, low_engagement)
  RealTimeMonitor → Threshold Check (looking_down ≥ 5? poor_eye_contact ≥ 10? speaking_too_fast ≥ 3?)
  
  [IF THRESHOLD EXCEEDED AND COOLDOWN ELAPSED]:
    RealTimeMonitor → Intervention Generator (creates personalized message: "Hi [name], maintain eye contact with camera!")
    RealTimeMonitor → Backend (intervention object: message, severity[low/medium/high], issue_type, timestamp)
    Backend → WebSocket ("intervention" message)
    WebSocket → Frontend (receives intervention)
    Frontend → InterventionAlert Component (displays colored banner: red=high, orange=medium, yellow=low)
    InterventionAlert → User (shows dismissible alert on screen)
```

### PHASE 3: ANSWER SUBMISSION & NEXT QUESTION
```
User → Frontend (clicks "Submit Answer" button)
Frontend → stopRecording (stops MediaRecorder)
Frontend → stopListening (stops SpeechRecognition)
Frontend → WebSocket ("answer" message: {question, transcript, duration_seconds, timestamp})
WebSocket → Backend (receives answer)
Backend → MongoDB (appends to session.responses[]: {question, answer, timestamp, duration_seconds, video_analytics, audio_analytics, real_time_feedback[]})
Backend → Question Index Check (more questions remaining?)
Backend → WebSocket ("next_question" message with next question object)
WebSocket → Frontend (receives next question)
Frontend → User (displays new question, resets transcript, continues loop to PHASE 2)

[LOOP CONTINUES UNTIL ALL QUESTIONS ANSWERED]
```

### PHASE 4: SESSION COMPLETION & REPORT CARD GENERATION
```
User → Frontend (clicks "End Session" button OR all questions answered)
Frontend → WebSocket ("end_session" message)
WebSocket → Backend (session termination signal)
Backend → MongoDB (fetch all responses[] from session document)
Backend → FeedbackGenerator (receives all responses with video_analytics + audio_analytics)

FeedbackGenerator → Aggregator (calculates averages: avg_eye_contact, avg_speaking_pace, total_filler_words, avg_volume, avg_engagement, emotion_distribution)
FeedbackGenerator → Score Calculator:
  - communication_score = f(eye_contact, speaking_pace, volume_consistency, filler_word_frequency) × 30%
  - confidence_score = f(engagement, emotion_positivity, pitch_consistency, head_position_stability) × 30%
  - content_quality_score = f(answer_length, relevance, structure) × 40%
  - overall_score = communication_score + confidence_score + content_quality_score

FeedbackGenerator → Threshold Analyzer:
  - strengths[] = metrics > good_threshold (e.g., eye_contact > 75%, filler_words < 5)
  - improvements[] = metrics < acceptable_threshold (e.g., eye_contact < 50%, speaking_pace > 180 WPM)

FeedbackGenerator → LLM Service (sends: job_position, aggregate_metrics, strengths, improvements, answer_transcripts)
LLM Service → Groq API (prompt: "Generate personalized constructive feedback with actionable recommendations for interview performance", temp=0.6)
Groq API → LLM Service (returns detailed_feedback text with sections: overall impression, strengths analysis, improvement areas, actionable recommendations)
LLM Service → FeedbackGenerator (detailed_feedback text)

FeedbackGenerator → Backend (complete feedback object: overall_score, communication_score, confidence_score, content_quality_score, metrics{}, strengths[], improvements[], detailed_feedback, recommendations[], analytics_timeline[])
Backend → MongoDB (update session document: feedback={...}, overall_score, status=completed)
Backend → WebSocket ("session_complete" message with complete feedback object)
WebSocket → Frontend (receives feedback)
Frontend → SessionComplete Component (renders report card)

SessionComplete Component → User Display:
  - Overall Score (large number display)
  - Component Scores Breakdown (communication, confidence, content as progress bars/gauges)
  - AnalyticsCharts (Recharts line/bar charts showing metrics over time: eye contact per question, speaking pace timeline, filler words per answer)
  - Strengths List (green checkmarks with descriptions)
  - Improvements List (orange warning icons with descriptions)
  - Detailed Feedback Section (LLM-generated personalized text)
  - Recommendations Section (actionable bullet points)
```

### PHASE 5: POST-SESSION ANALYTICS (OPTIONAL)
```
User → Frontend (navigates to /results/{session_id} or Dashboard)
Frontend → Backend API (GET /api/sessions or GET /api/sessions/{id}/analytics)
Backend → MongoDB (query sessions collection: filter by user_id, sort by session_date)
Backend → Frontend (returns session summaries or detailed analytics)
Frontend → AnalyticsCharts/CompareSession (displays interactive charts)
User → Frontend (can compare multiple sessions side-by-side, view progress trends, download reports)
```

---

## KEY TECHNICAL INTERACTIONS (FOR DIAGRAM COMPONENTS)

### WebSocket Communication Pattern
- **Bidirectional persistent connection** for real-time streaming
- **Frontend sends**: video_frame (base64), audio_chunk (base64 + transcript), auth (JWT), answer (question + transcript + duration), end_session
- **Backend sends**: next_question (question object), intervention (message + severity), session_complete (feedback object), heartbeat (keep-alive)

### AI Pipeline Architecture
1. **Video Pipeline**: Raw Frame → Base64 → OpenCV Decode → MediaPipe (468 landmarks) → DeepFace (emotions) → Engagement Score
2. **Audio Pipeline**: Raw Audio → Base64 → librosa Load → RMS/Pitch/Pace Analysis → Filler Word Regex → Metrics
3. **LLM Pipeline**: Resume Text + Job Description → Groq Llama 3.1 8B → Questions JSON | Aggregate Metrics + Transcripts → Groq → Feedback Text

### Database Relationships
- User (1) ←→ (N) Sessions
- Session (1) ←→ (N) Responses (embedded in session document)
- Session contains generated_questions[] (array), responses[] (array of objects), feedback{} (object)

### Security Layer
- JWT Authentication: Generated at login, stored in localStorage, sent in Authorization header for REST APIs, sent in WebSocket auth message
- Password Security: bcrypt hashing with automatic salt (12 rounds)
- CORS Policy: Configured to allow frontend origin
- Environment Variables: JWT_SECRET_KEY, MONGODB_URL, GROQ_API_KEY stored in .env (gitignored)

---

## DEPLOYMENT ARCHITECTURE

**Frontend Deployment**:
- React build → static files (HTML/CSS/JS bundles)
- Hosted on: Netlify / Vercel / AWS S3 + CloudFront CDN

**Backend Deployment**:
- Docker container (Dockerfile: Python 3.9, pip install requirements.txt, CMD uvicorn)
- Deployed on: Docker Compose / Kubernetes / AWS ECS / Azure Container Instances
- Environment variables injected at runtime
- Exposes port 8000 for HTTP/WebSocket traffic

**Database Deployment**:
- MongoDB Atlas (managed cloud service) OR Docker container
- Indexes: users.email (unique), sessions.user_id, sessions.session_date, compound (user_id + status)

**CI/CD Pipeline**:
GitHub Actions → Build Docker Image → Push to Docker Hub/ECR → Deploy to Production → Health Check

---

## DIAGRAM SUGGESTIONS

### Component Diagram Elements:
- **Frontend Box**: React Components (LoginForm, CreateSession, InterviewSession, SessionComplete) + Custom Hooks (useWebSocket, useMediaRecorder, useSpeechRecognition)
- **Backend Box**: FastAPI Routers (auth, sessions, websocket, analytics) + Services (LLMService, VideoAnalyzer, AudioAnalyzer, RealTimeMonitor, FeedbackGenerator)
- **Database Cylinder**: MongoDB (users collection, sessions collection)
- **External Services Cloud**: Groq API (Llama 3.1 8B)
- **AI Models Box**: MediaPipe Face Mesh, DeepFace, librosa, Whisper

### Sequence Diagram Flow:
1. Authentication (one-time): User → Frontend → Backend → MongoDB → JWT
2. Session Creation: User input → Resume upload → Backend parse → LLM questions → MongoDB
3. Interview Loop: Question display → Recording → Streaming → Analysis → Interventions → Answer submit → Next question
4. Report Generation: End session → Aggregate metrics → LLM feedback → MongoDB save → Display report

### Deployment Diagram Elements:
- **Client Browser** (runs React app)
- **Web Server/CDN** (serves static files)
- **Application Server** (Docker container running FastAPI + Uvicorn)
- **Database Server** (MongoDB instance)
- **External API** (Groq)
- Connections: HTTPS (REST), WSS (WebSocket), TCP (MongoDB)

---

## TECHNICAL SUMMARY FOR AI DIAGRAM GENERATION

**System Type**: Full-stack real-time web application with AI-powered analysis
**Architecture Pattern**: Three-tier (Presentation/Application/Data) with WebSocket real-time communication
**Core Technologies**: React 19.2.0, FastAPI 0.104.1, MongoDB, MediaPipe 0.10.21, DeepFace 0.0.79, librosa 0.10.1, Groq Llama 3.1 8B
**Key Features**: Resume parsing → LLM question generation → Real-time video/audio streaming → AI analysis (facial landmarks, emotions, audio metrics) → Sub-second interventions → Comprehensive report card generation
**Data Flow**: One-time auth → Session creation with resume upload → Questions generation by LLM → Real-time interview with AI monitoring → Feedback generation → Report display
**Unique Aspects**: Bidirectional WebSocket streaming, concurrent video + audio analysis in ThreadPoolExecutor, issue counter thresholds with cooldown, weighted scoring algorithm, LLM-generated personalized feedback
