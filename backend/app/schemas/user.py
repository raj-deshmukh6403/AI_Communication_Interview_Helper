from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    """
    Schema for user registration request.
    """
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: str = Field(..., min_length=2)
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "securepassword123",
                "full_name": "John Doe"
            }
        }

class UserLogin(BaseModel):
    """
    Schema for user login request.
    """
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    """
    Schema for user data returned in API responses.
    Note: Never send password back to client!
    """
    id: str
    email: str
    full_name: str
    created_at: datetime
    sessions_count: int
    total_practice_time_minutes: float = 0.0
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "email": "user@example.com",
                "full_name": "John Doe",
                "created_at": "2024-01-01T00:00:00",
                "sessions_count": 5,
                "total_practice_time_minutes": 45.5
            }
        }

class UserUpdate(BaseModel):
    """
    Schema for updating user profile.
    """
    full_name: Optional[str] = None
    
class PasswordReset(BaseModel):
    """
    Schema for password reset request.
    """
    email: EmailStr

class PasswordChange(BaseModel):
    """
    Schema for changing password.
    """
    old_password: str
    new_password: str = Field(..., min_length=8)

class Token(BaseModel):
    """
    Schema for JWT token response.
    """
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    """
    Schema for data stored inside JWT token.
    """
    email: Optional[str] = None