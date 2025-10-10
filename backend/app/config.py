from pydantic_settings import BaseSettings
from typing import Optional, Literal

class Settings(BaseSettings):
    """
    Application configuration settings loaded from environment variables.
    """
    # Database
    mongodb_url: str
    database_name: str
    
    # JWT Authentication
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200  # 30 days default
    
    # LLM API
    GROQ_API_KEY: Optional[str] = None
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # NEW: Speech Recognition Configuration
    speech_recognition_mode: Literal["whisper", "browser", "hybrid"] = "hybrid"
    whisper_model_size: Literal["tiny", "base", "small", "medium", "large"] = "base"
    whisper_enabled: bool = True  # Can be disabled if model fails to load
    
    # Performance settings
    max_audio_chunk_size_mb: float = 5.0  # Max audio chunk size for Whisper
    enable_gpu: bool = True  # Try to use GPU if available
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Create a global settings instance
settings = Settings()