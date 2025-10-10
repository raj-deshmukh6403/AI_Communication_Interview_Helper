# 🎯 AI Virtual Interview Coach

An intelligent interview practice platform that provides **real-time feedback** on your communication skills, body language, and answer quality using AI and computer vision.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![React](https://img.shields.io/badge/react-18.2.0-blue.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.104.1-green.svg)

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [WebSocket Protocol](#websocket-protocol)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

### 🎥 Real-Time Video Analysis
- **Face Detection**: MediaPipe-powered facial landmark detection
- **Eye Contact Tracking**: Monitor gaze direction and engagement
- **Emotion Recognition**: DeepFace emotion analysis
- **Posture Analysis**: Head position and movement tracking
- **Live Interventions**: Instant feedback on body language issues

### 🎤 Audio & Speech Analysis
- **Voice Analysis**: Speaking pace, volume, and pitch tracking
- **Filler Word Detection**: Identify and count "um", "uh", "like", etc.
- **Speech-to-Text**: Browser-based real-time transcription
- **Whisper Integration**: Optional backend transcription
- **Vocal Quality Metrics**: Monotone detection, energy levels

### 🤖 AI-Powered Features
- **Smart Question Generation**: Groq LLaMA 3.1 generates personalized questions
- **Resume Analysis**: Tailored questions based on uploaded resume
- **Answer Evaluation**: AI scoring of relevance, clarity, and completeness
- **STAR Method Detection**: Identifies structured behavioral responses
- **Comprehensive Feedback**: Detailed AI-generated improvement suggestions

### 📊 Analytics & Progress Tracking
- **Session Analytics**: Detailed metrics for each interview
- **Progress Charts**: Visual representation of improvement over time
- **Weak Area Identification**: Highlights areas needing focus
- **Performance Comparison**: Compare multiple sessions
- **Downloadable Reports**: Export feedback as JSON

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI 0.104.1
- **Database**: MongoDB (Motor async driver)
- **Authentication**: JWT (python-jose)
- **AI/ML**:
  - Groq API (LLaMA 3.1 70B)
  - MediaPipe (face detection)
  - DeepFace (emotion recognition)
  - OpenAI Whisper (speech-to-text)
  - Librosa (audio analysis)
- **Real-time**: WebSocket
- **Document Processing**: PyPDF2, python-docx

### Frontend
- **Framework**: React 18.2.0
- **Routing**: React Router DOM 6.20.1
- **HTTP Client**: Axios 1.6.2
- **Charts**: Recharts 2.10.3
- **UI Components**: Tailwind CSS 3.3.6
- **Icons**: Lucide React 0.294.0
- **Media Handling**: react-webcam, recordrtc

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  React Frontend (Port 3000) + Browser APIs                  │
│  - Camera/Microphone Access                                  │
│  - Speech Recognition                                        │
│  - WebSocket Client                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway Layer                          │
│  FastAPI Backend (Port 8000)                                │
│  - REST API Endpoints                                        │
│  - WebSocket Server                                          │
│  - JWT Authentication                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├──────────┬──────────┬──────────┐
                     ▼          ▼          ▼          ▼
┌──────────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│ LLM Service  │ │ Video  │ │ Audio  │ │ Real-Time    │
│ (Groq API)   │ │Analyzer│ │Analyzer│ │ Monitor      │
└──────────────┘ └────────┘ └────────┘ └──────────────┘
                     │          │          │
                     └──────────┴──────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  MongoDB Atlas   │
                    │  - Users         │
                    │  - Sessions      │
                    │  - Analytics     │
                    └──────────────────┘
```

---

## 📦 Prerequisites

### Required Software
- **Python**: 3.10 or higher
- **Node.js**: 16.x or higher
- **npm**: 8.x or higher
- **MongoDB**: 4.4+ (local) or MongoDB Atlas (cloud)

### API Keys
- **Groq API Key**: Get free key from [console.groq.com](https://console.groq.com)
- **MongoDB Connection String**: From MongoDB Atlas or local instance

### System Requirements
- **RAM**: Minimum 4GB (8GB recommended for Whisper)
- **Webcam**: For video analysis
- **Microphone**: For audio analysis
- **Browser**: Chrome/Firefox/Safari (latest versions)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ai-interview-coach.git
cd ai-interview-coach
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install
```

---

## ⚙️ Configuration

### Backend Configuration

Create `backend/.env`:

```env
# Database
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/ai_interview_helper
DATABASE_NAME=ai_interview_helper

# JWT Authentication
JWT_SECRET_KEY=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200

# Groq API (Free LLM)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Server
HOST=0.0.0.0
PORT=8000

# Speech Recognition
SPEECH_RECOGNITION_MODE=hybrid
WHISPER_MODEL_SIZE=base
WHISPER_ENABLED=true
ENABLE_GPU=false

# Performance
MAX_AUDIO_CHUNK_SIZE_MB=5.0
```

### Frontend Configuration

Create `frontend/.env`:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000

# Feature Flags
REACT_APP_ENABLE_SPEECH_RECOGNITION=true
REACT_APP_ENABLE_VIDEO_ANALYSIS=true

# Performance Settings
REACT_APP_VIDEO_FPS=2
REACT_APP_AUDIO_CHUNK_DURATION=3000

# Analytics
REACT_APP_ENABLE_ANALYTICS=true
```

---

## 🎬 Running the Application

### Option 1: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python run.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Option 2: Docker (see Docker section below)

### Access Points:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **WebSocket**: ws://localhost:8000/ws/interview/{session_id}

---

## 📁 Project Structure

```
ai-interview-coach/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI application
│   │   ├── config.py               # Configuration
│   │   ├── database.py             # MongoDB connection
│   │   ├── models/                 # Pydantic models
│   │   │   ├── user.py
│   │   │   ├── session.py
│   │   │   └── analytics.py
│   │   ├── routers/                # API endpoints
│   │   │   ├── auth.py
│   │   │   ├── sessions.py
│   │   │   ├── analytics.py
│   │   │   └── websocket.py
│   │   ├── services/               # Business logic
│   │   │   ├── llm_service.py
│   │   │   ├── video_analyzer.py
│   │   │   ├── audio_analyzer.py
│   │   │   ├── feedback_generator.py
│   │   │   └── real_time_monitor.py
│   │   ├── schemas/                # Request/Response schemas
│   │   └── utils/                  # Helper functions
│   ├── requirements.txt
│   ├── .env
│   └── run.py
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/             # Reusable components
│   │   │   ├── auth/               # Authentication
│   │   │   ├── layout/             # Layout components
│   │   │   ├── dashboard/          # Dashboard
│   │   │   ├── session/            # Interview session
│   │   │   └── analytics/          # Analytics & charts
│   │   ├── services/               # API services
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── context/                # React context
│   │   ├── utils/                  # Utilities
│   │   ├── pages/                  # Page components
│   │   ├── App.jsx
│   │   └── index.js
│   ├── package.json
│   └── .env
│
├── docker-compose.yml
├── README.md
└── LICENSE
```

---

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "full_name": "John Doe"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=SecurePass123
```

### Session Endpoints

#### Create Session
```http
POST /sessions/create
Authorization: Bearer {token}
Content-Type: multipart/form-data

session: {"job_description": "...", "position": "..."}
resume: [file]
```

#### Get Sessions
```http
GET /sessions/list?limit=20&skip=0
Authorization: Bearer {token}
```

#### Get Session Detail
```http
GET /sessions/{session_id}
Authorization: Bearer {token}
```

### Analytics Endpoints

#### Get Session Analytics
```http
GET /analytics/{session_id}
Authorization: Bearer {token}
```

#### Get User Summary
```http
GET /analytics/user/summary
Authorization: Bearer {token}
```

#### Get Weak Areas
```http
GET /analytics/user/weak-areas?limit=5
Authorization: Bearer {token}
```

---

## 🔌 WebSocket Protocol

### Connection
```javascript
ws://localhost:8000/ws/interview/{session_id}
```

### Message Types

**Client → Server:**
```json
// Authentication
{"type": "auth", "token": "jwt_token"}

// Video frame
{"type": "video_frame", "data": "base64_image", "timestamp": 1234567890}

// Audio chunk
{"type": "audio_chunk", "data": "base64_audio", "transcript": "text", "timestamp": 1234567890}

// Submit answer
{"type": "answer", "question": "...", "answer": "...", "duration": 30.5}

// End session
{"type": "end_session"}
```

**Server → Client:**
```json
// Next question
{"type": "next_question", "question": {...}, "question_number": 1}

// Real-time intervention
{"type": "intervention", "intervention": {"message": "...", "severity": "high"}}

// Analytics update
{"type": "analytics", "data": {...}}

// Session complete
{"type": "session_complete", "feedback": {...}}
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. MongoDB Connection Error
```
Error: Could not connect to MongoDB
```
**Solution**: Check MongoDB URL in `.env` and ensure MongoDB is running

#### 2. Camera/Microphone Not Working
```
Error: NotAllowedError: Permission denied
```
**Solution**: 
- Allow camera/microphone permissions in browser
- Use HTTPS in production (required for camera access)

#### 3. Whisper Model Loading Error
```
Error: Failed to load Whisper model
```
**Solution**: 
- Set `WHISPER_ENABLED=false` in `.env` to use browser transcription
- Or install with: `pip install openai-whisper`

#### 4. CORS Error in Frontend
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution**: Check backend `main.py` CORS settings include frontend URL

#### 5. Session Creation 422 Error
```
422 Unprocessable Entity
```
**Solution**: Use the fixed `CreateSession.jsx` code provided above

---

## 🐳 Docker Setup

### Dockerfile - Backend

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Dockerfile - Frontend

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URL=${MONGODB_URL}
      - GROQ_API_KEY=${GROQ_API_KEY}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
    volumes:
      - ./backend:/app
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:8000
      - REACT_APP_WS_URL=ws://localhost:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

### Running with Docker

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 👨‍💻 Authors

- **Rajvardhan Deshmukh** - 

---

## 🙏 Acknowledgments

- **Groq** for free LLM API access
- **MediaPipe** for face detection
- **OpenAI** for Whisper model
- **FastAPI** for excellent web framework
- **React** community for amazing tools


---
