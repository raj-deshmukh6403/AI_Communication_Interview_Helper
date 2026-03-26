# AI Interview Coach - Detailed Use Cases & Flows

## Table of Contents
1. [System Overview](#system-overview)
2. [Actors](#actors)
3. [Detailed Use Cases](#detailed-use-cases)
4. [System Flows](#system-flows)
5. [Technical Architecture](#technical-architecture)

---

## System Overview

The AI Interview Coach is a real-time interview practice platform that provides:
- **Live Video/Audio Analysis**: Monitors facial expressions, eye contact, gestures, voice quality
- **Speech-to-Text Transcription**: Converts spoken answers to text in real-time
- **AI-Powered Feedback**: Generates questions and provides instant feedback using LLM (Gemini)
- **Real-time Interventions**: Alerts users about communication issues during the interview
- **Comprehensive Analytics**: Post-session performance metrics and recommendations

---

## Actors

### 1. **Candidate/Interviewee** (Primary Actor)
- End user practicing interview skills
- Interacts with frontend interface
- Provides verbal and visual responses
- Receives real-time feedback

### 2. **AI Coach/System** (Secondary Actor)
- Backend services and AI models
- Analyzes video, audio, and speech
- Generates questions and feedback
- Provides interventions

### 3. **Backend Services** (Supporting Actor)
- WebSocket server
- Database management
- Media processing pipelines
- LLM integration

---

## Detailed Use Cases

### **UC1: Register Account**
**Actor**: Candidate  
**Preconditions**: None  
**Main Flow**:
1. User navigates to registration page
2. User enters email, password, full name
3. System validates input format
4. System checks if email already exists
5. System hashes password and creates user record
6. System sends JWT token
7. User is redirected to dashboard

**Postconditions**: User account created, authenticated session established  
**Alternative Flows**:
- 4a. Email already exists → Show error, prompt login
- 3a. Invalid format → Show validation errors

---

### **UC2: Login**
**Actor**: Candidate  
**Preconditions**: User must have registered account  
**Main Flow**:
1. User enters email and password
2. System verifies credentials against database
3. System generates JWT token
4. Frontend stores token in localStorage
5. User redirected to dashboard

**Postconditions**: User authenticated  
**Alternative Flows**:
- 2a. Invalid credentials → Show error, allow retry

---

### **UC3: Create New Session**
**Actor**: Candidate  
**Preconditions**: User must be authenticated  
**Main Flow**:
1. User clicks "New Session" button
2. System displays session configuration form
3. User selects:
   - Job role (e.g., Software Engineer, Product Manager)
   - Difficulty level (Easy/Medium/Hard)
   - Duration (15/30/45 minutes)
   - Question types (Technical, Behavioral, Communication)
4. User submits configuration
5. Backend creates session record in database
6. Backend generates session ID
7. User redirected to interview page

**Postconditions**: Session created with unique ID  
**Alternative Flows**:
- 3a. User cancels → Return to dashboard

---

### **UC7: Start Interview**
**Actor**: Candidate  
**Preconditions**: Session created, user on interview page  
**Main Flow**:
1. **Permission Request**:
   - Frontend requests camera and microphone access
   - Browser shows permission dialog
   - User grants permissions
   
2. **Media Initialization**:
   - Frontend initializes MediaRecorder with video/audio streams
   - Video element displays camera feed (mirrored)
   - Speech recognition initialized (Web Speech API)

3. **WebSocket Connection**:
   - Frontend establishes WebSocket connection with session_id
   - Backend authenticates connection
   - Backend sends AUTH_SUCCESS message

4. **Recording Start**:
   - Frontend starts recording video at 2 FPS
   - Frontend starts recording audio chunks (1-second intervals)
   - Speech recognition starts listening

5. **First Question**:
   - Backend requests question from LLM service
   - LLM generates contextual question based on job role
   - Backend sends NEXT_QUESTION message
   - Frontend displays question in bottom-left overlay
   - Timer starts counting

**Postconditions**: Interview active, user can answer questions  
**Alternative Flows**:
- 1a. User denies permissions → Show error, cannot proceed
- 3a. WebSocket connection fails → Show error, retry

**Includes**: UC10 (Grant Permissions), UC29 (WebSocket Connection)

---

### **UC12: Answer Question (Voice)**
**Actor**: Candidate  
**Preconditions**: Question displayed, recording active  
**Main Flow**:
1. **Speech Capture**:
   - User speaks answer into microphone
   - Speech recognition converts speech to text in real-time
   - Transcript displayed in answer status indicator
   - Frontend shows "Listening..." status

2. **Data Transmission**:
   - Every 1 second: Audio chunk sent via WebSocket
   - Every 500ms: Video frame captured and sent
   - Transcript included with audio chunks

3. **Real-time Analysis** (Parallel):
   - **Video Analysis**:
     - Detect face landmarks (eyes, mouth, head pose)
     - Calculate eye contact percentage
     - Detect facial expressions (confidence, nervousness)
     - Identify excessive head movements
   
   - **Audio Analysis**:
     - Measure speech rate (words per minute)
     - Detect filler words ("um", "uh", "like")
     - Analyze voice tone and energy
     - Calculate pause patterns

4. **Intervention Triggers**:
   - If filler word count > threshold → Send INTERVENTION
   - If eye contact < 60% → Send INTERVENTION
   - If speech rate too fast/slow → Send INTERVENTION
   - Frontend displays intervention alerts (auto-dismiss after 8s)

5. **Answer Completion** (Multiple paths):
   - **Path A - User clicks "Done"**: UC14 triggered
   - **Path B - Auto-submit after 5s silence**: Detected by frontend
   - **Path C - User clicks "Skip"**: UC13 triggered

**Postconditions**: Answer captured and sent to backend  
**Includes**: UC19 (Speech Transcription), UC27 (Video Capture), UC28 (Audio Recording)  
**Extends**: UC13 (Skip), UC14 (Done)

---

### **UC13: Skip Question**
**Actor**: Candidate  
**Preconditions**: Question displayed, answer in progress  
**Main Flow**:
1. User clicks "Skip" button on question overlay
2. Frontend sends SUBMIT_ANSWER with empty answer text
3. Frontend stops speech recognition
4. Frontend resets transcript
5. Backend logs skip event
6. Backend proceeds to next question

**Postconditions**: Question skipped, next question loaded  
**Extends**: UC12

---

### **UC14: Mark Answer Done**
**Actor**: Candidate  
**Preconditions**: User has spoken answer (transcript > 0 chars)  
**Main Flow**:
1. User clicks "Done" button on question overlay
2. Frontend collects full transcript
3. Frontend calculates answer duration
4. Frontend sends SUBMIT_ANSWER message:
   ```json
   {
     "type": "SUBMIT_ANSWER",
     "question": "Tell me about yourself",
     "answer": "Full transcript text...",
     "duration": 45.3
   }
   ```
5. Frontend stops speech recognition
6. Frontend shows "Answer submitted" confirmation
7. Backend processes answer

**Postconditions**: Answer submitted, waiting for next question  
**Extends**: UC12

---

### **UC17: Analyze Video (Facial, Gestures)**
**Actor**: AI System  
**Preconditions**: Video frames received from frontend  
**Main Flow**:
1. Backend receives base64-encoded video frame
2. Video analyzer decodes frame to image array
3. **Face Detection**:
   - Detect face using MediaPipe/OpenCV
   - Extract facial landmarks (468 points)
   
4. **Eye Contact Analysis**:
   - Calculate gaze direction from eye landmarks
   - Determine if looking at camera (±15° tolerance)
   - Track eye contact percentage over time

5. **Expression Analysis**:
   - Classify facial expression (neutral, smile, frown, surprise)
   - Detect confidence indicators (smile, steady gaze)
   - Detect nervousness indicators (lip biting, eye avoidance)

6. **Gesture Analysis**:
   - Detect excessive head movements
   - Track hand gestures (if visible)

7. **Results Storage**:
   - Store frame analysis in session analytics
   - Send real-time metrics via WebSocket (if intervention needed)

**Postconditions**: Video metrics stored, interventions sent if needed  
**Triggers**: UC21 (Real-time Interventions)

---

### **UC18: Analyze Audio (Voice Quality)**
**Actor**: AI System  
**Preconditions**: Audio chunks received from frontend  
**Main Flow**:
1. Backend receives base64-encoded audio blob
2. Audio analyzer decodes to WAV/PCM format
3. **Volume Analysis**:
   - Calculate RMS (root mean square) energy
   - Detect if volume too low or too high

4. **Pitch Analysis**:
   - Extract fundamental frequency (F0)
   - Detect monotone speech (low pitch variance)

5. **Speech Rate**:
   - Count words from transcript
   - Calculate words per minute
   - Flag if < 120 WPM (too slow) or > 180 WPM (too fast)

6. **Filler Word Detection**:
   - Parse transcript for ["um", "uh", "like", "you know", "sort of"]
   - Count occurrences
   - Flag if > 5 fillers per minute

7. **Pause Analysis**:
   - Detect silence segments in audio
   - Calculate pause ratio
   - Flag excessive long pauses (>3 seconds)

**Postconditions**: Audio metrics stored  
**Triggers**: UC21 (Real-time Interventions)

---

### **UC19: Transcribe Speech**
**Actor**: AI System  
**Preconditions**: Speech recognition active (frontend)  
**Main Flow**:
1. Frontend Web Speech API listens to microphone
2. Browser sends audio to speech recognition service (Google/Browser API)
3. API returns interim results (partial transcript)
4. Frontend updates interim transcript display
5. On final result (sentence complete):
   - Append to final transcript
   - Clear interim transcript
   - Send with next audio chunk

**Postconditions**: Real-time transcript available  
**Note**: This is primarily frontend-based using browser APIs

---

### **UC21: Generate Real-time Interventions**
**Actor**: AI System  
**Preconditions**: Video/audio analysis complete  
**Main Flow**:
1. **Monitor Metrics**:
   - Check latest video analysis (eye contact, expression)
   - Check latest audio analysis (fillers, speech rate)

2. **Apply Rules**:
   ```python
   if filler_count > 5 per minute:
       intervention = {
           "type": "warning",
           "category": "speech",
           "message": "Try to reduce filler words like 'um' and 'uh'"
       }
   
   if eye_contact_percentage < 60%:
       intervention = {
           "type": "warning", 
           "category": "body_language",
           "message": "Maintain eye contact with the camera"
       }
   
   if speech_rate > 180 WPM:
       intervention = {
           "type": "suggestion",
           "category": "speech",
           "message": "Slow down - you're speaking too fast"
       }
   ```

3. **Send Intervention**:
   - Backend sends INTERVENTION message via WebSocket
   - Frontend displays intervention alert (floating notification)
   - Alert auto-dismisses after 8 seconds

4. **Rate Limiting**:
   - Maximum 1 intervention per 15 seconds
   - Avoid overwhelming user with alerts

**Postconditions**: User receives actionable feedback  
**Includes**: UC17, UC18

---

### **UC22: Generate Session Feedback**
**Actor**: AI System  
**Preconditions**: Session completed or ended early  
**Main Flow**:
1. **Data Collection**:
   - Fetch all answers from database
   - Fetch all video analytics records
   - Fetch all audio analytics records
   - Calculate aggregate metrics

2. **Answer Evaluation** (per question):
   - Send answer + question to LLM (Gemini)
   - Prompt: "Evaluate this interview answer for [job_role]. Provide: score (1-10), strengths, improvements."
   - LLM returns structured feedback

3. **Overall Analysis**:
   - **Communication Score**:
     - Eye contact average: 25%
     - Filler words: 25%
     - Speech clarity: 25%
     - Confidence (facial): 25%
   
   - **Technical Score** (from LLM answer evaluations):
     - Average of all answer scores
   
   - **Overall Score**:
     - (Communication Score + Technical Score) / 2

4. **Generate Recommendations**:
   - LLM generates personalized improvement tips
   - Highlight top 3 strengths
   - Highlight top 3 areas for improvement

5. **Create Report**:
   ```json
   {
     "overall_score": 75,
     "communication_score": 72,
     "technical_score": 78,
     "eye_contact_percentage": 68,
     "filler_word_count": 12,
     "average_speech_rate": 145,
     "strengths": ["Clear communication", "Good structure", "Confident tone"],
     "improvements": ["Reduce filler words", "More eye contact", "Elaborate on examples"],
     "answer_feedback": [...]
   }
   ```

6. **Send to Frontend**:
   - Backend sends SESSION_COMPLETE message
   - Frontend displays SessionComplete screen

**Postconditions**: Comprehensive feedback generated and displayed  
**Includes**: UC17, UC18, UC19

---

### **UC25: View Detailed Analytics**
**Actor**: Candidate  
**Preconditions**: Session completed  
**Main Flow**:
1. User navigates to session results page
2. Frontend requests GET /sessions/{id}/analytics
3. Backend retrieves:
   - Session metadata
   - All Q&A pairs
   - Time-series video metrics
   - Time-series audio metrics
   - Intervention history

4. **Display Components**:
   - **Performance Overview Cards**:
     - Overall score (large display)
     - Communication score
     - Technical score
     - Session duration
   
   - **Detailed Metrics Charts**:
     - Eye contact over time (line chart)
     - Speech rate over time (line chart)
     - Filler words per question (bar chart)
     - Facial confidence over time (area chart)
   
   - **Question-by-Question Breakdown**:
     - Each question with answer
     - Individual score
     - LLM feedback
     - Metrics during that answer
   
   - **Interventions Timeline**:
     - All interventions shown chronologically
     - Color-coded by category

5. **Export Options**:
   - Download PDF report
   - Share session link (if enabled)

**Postconditions**: User gains insights into performance

---

### **UC24: Compare Sessions**
**Actor**: Candidate  
**Preconditions**: User has completed 2+ sessions  
**Main Flow**:
1. User navigates to analytics page
2. User selects "Compare Sessions"
3. User picks 2-5 sessions to compare
4. Frontend requests comparison data from backend
5. Backend calculates delta metrics:
   - Score improvements
   - Filler word reduction
   - Eye contact improvement
   - Speech rate stabilization

6. **Display**:
   - Side-by-side score comparison
   - Trend line charts showing progress
   - Improvement percentage badges
   - Recommendations based on trends

**Postconditions**: User sees progress over time

---

## System Flows

### **Complete Interview Session Flow**

```
┌─────────────┐
│   START     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ 1. User Authentication  │
│ • Register or Login     │
│ • Store JWT token       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 2. Create Session       │
│ • Select job role       │
│ • Select difficulty     │
│ • Set duration          │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 3. Grant Permissions    │
│ • Camera access         │
│ • Microphone access     │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 4. Initialize Media     │
│ • Start video stream    │
│ • Start audio recording │
│ • Start speech recog    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 5. Connect WebSocket    │
│ • Establish connection  │
│ • Authenticate session  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 6. Receive Question     │
│ • LLM generates Q       │
│ • Display in overlay    │
│ • Start timer           │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ 7. Answer Question                  │
│ ┌─────────────────────────────────┐ │
│ │ Parallel Processing:            │ │
│ │ • User speaks answer            │ │
│ │ • Speech → Text (real-time)     │ │
│ │ • Video frames → Backend (2fps) │ │
│ │ • Audio chunks → Backend (1/s)  │ │
│ │                                 │ │
│ │ • Video analysis (eye, face)    │ │
│ │ • Audio analysis (rate, tone)   │ │
│ │ • Generate interventions        │ │
│ └─────────────────────────────────┘ │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│ 8. Submit Answer        │
│ • User clicks Done/Skip │
│ • OR auto-submit (5s)   │
│ • Send to backend       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 9. LLM Evaluates Answer │
│ • Score answer (1-10)   │
│ • Provide feedback      │
│ • Store in database     │
└──────────┬──────────────┘
           │
           ▼
      ┌────┴────┐
      │ More Q? │
      └────┬────┘
           │
     ┌─────┴─────┐
     │           │
    YES          NO
     │           │
     │           ▼
     │    ┌──────────────────┐
     │    │ 10. End Session  │
     │    │ • Generate report│
     │    │ • Calculate score│
     │    │ • Send feedback  │
     │    └────────┬─────────┘
     │             │
     │             ▼
     │    ┌──────────────────┐
     │    │ 11. Show Results │
     │    │ • Display scores │
     │    │ • Show analytics │
     │    │ • Recommendations│
     │    └────────┬─────────┘
     │             │
     │             ▼
     │         ┌───────┐
     └────────►│  END  │
               └───────┘
```

---

## Technical Architecture

### **Component Diagram**

```
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Pages    │  │ Components │  │   Hooks    │            │
│  │ • Login    │  │ • Video    │  │ • Media    │            │
│  │ • Dashboard│  │ • Question │  │ • Speech   │            │
│  │ • Interview│  │ • Feedback │  │ • WebSocket│            │
│  │ • Results  │  │ • Analytics│  │            │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │            Services                             │        │
│  │  • API (axios)      • MediaService             │        │
│  │  • AuthService      • WebSocketService         │        │
│  └─────────────────────────────────────────────────┘        │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ HTTP/HTTPS
                         │ WebSocket (ws://)
                         │
┌────────────────────────┴─────────────────────────────────────┐
│                         BACKEND                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Routers   │  │   Models   │  │  Services  │            │
│  │ • Auth     │  │ • User     │  │ • LLM      │            │
│  │ • Sessions │  │ • Session  │  │ • Video    │            │
│  │ • WebSocket│  │ • Analytics│  │ • Audio    │            │
│  │ • Analytics│  │            │  │ • Feedback │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │     External Integrations                       │        │
│  │  • Google Gemini API (LLM)                      │        │
│  │  • PostgreSQL (Database)                        │        │
│  │  • MediaPipe/OpenCV (Video processing)          │        │
│  └─────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend Framework | React 18 | UI rendering, component state |
| Styling | Tailwind CSS | Responsive design |
| Video/Audio Capture | MediaRecorder API | Capture media streams |
| Speech Recognition | Web Speech API | Real-time transcription |
| WebSocket | Native WebSocket | Real-time bidirectional communication |
| Backend Framework | FastAPI (Python) | REST API + WebSocket server |
| Database | PostgreSQL | Persistent data storage |
| ORM | SQLAlchemy | Database models |
| AI/LLM | Google Gemini | Question generation, answer evaluation |
| Video Analysis | MediaPipe/OpenCV | Face detection, eye tracking |
| Audio Analysis | Librosa/PyAudio | Speech rate, tone analysis |

---

## Data Flow Summary

1. **Registration/Login**: JWT-based authentication
2. **Session Creation**: REST API creates session record
3. **WebSocket Connection**: Bidirectional real-time channel
4. **Media Streaming**: 
   - Video: 2 FPS (base64 JPEG)
   - Audio: 1 second chunks (base64 WebM/Opus)
   - Transcript: Sent with audio chunks
5. **Analysis Pipeline**:
   - Video frames → Face detection → Eye tracking → Metrics
   - Audio chunks → Volume/Pitch → Speech rate → Metrics
   - Transcript → Filler word detection → Metrics
6. **Intervention System**: Rules engine checks metrics → Sends alerts
7. **Answer Evaluation**: LLM scores answers on submission
8. **Session Completion**: Aggregate all data → Generate comprehensive feedback
9. **Analytics Display**: Visualize time-series and comparative data

---

## File Structure Reference

### Frontend Key Files
- `src/pages/InterviewPage.jsx` - Main interview page
- `src/components/session/InterviewSession.jsx` - Interview orchestration
- `src/components/session/QuestionOverlay.jsx` - Question display (bottom-left)
- `src/hooks/useMediaRecorder.js` - Camera/mic management
- `src/hooks/useSpeechRecognition.js` - Speech-to-text
- `src/hooks/useWebSocket.js` - WebSocket communication
- `src/services/mediaService.js` - Media capture utilities
- `src/services/websocketService.js` - WebSocket message handling

### Backend Key Files
- `app/routers/websocket.py` - WebSocket endpoint & message handlers
- `app/services/video_analyzer.py` - Video frame analysis
- `app/services/audio_analyzer.py` - Audio chunk analysis
- `app/services/llm_service.py` - Gemini API integration
- `app/services/feedback_generator.py` - Session feedback compilation
- `app/models/session.py` - Session database model
- `app/models/analytics.py` - Analytics database model

---

## Conclusion

This AI Interview Coach system provides a comprehensive, real-time interview practice experience with:
- ✅ Live video and audio analysis
- ✅ Instant feedback and interventions
- ✅ AI-powered question generation and evaluation
- ✅ Detailed performance analytics
- ✅ Progress tracking across sessions

The use case diagram and flows above document the complete system behavior from user registration through post-session analytics.
