from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import connect_to_mongo, close_mongo_connection
from .routers import auth, sessions, analytics, websocket

# Create FastAPI app
app = FastAPI(
    title="AI Interview Coach API",
    description="Real-time AI-powered interview practice and coaching system",
    version="1.0.0"
)

# CORS middleware - Configure for your frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        # Add your production domain here
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Event handlers
@app.on_event("startup")
async def startup_db_client():
    """Connect to MongoDB on startup."""
    await connect_to_mongo()
    print("✅ Connected to MongoDB")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown."""
    await close_mongo_connection()
    print("❌ Closed MongoDB connection")

# Include routers
app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(analytics.router)
app.include_router(websocket.router)

# Root endpoint
@app.get("/")
async def root():
    """API root endpoint."""
    return {
        "message": "AI Interview Coach API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "database": "connected"
    }