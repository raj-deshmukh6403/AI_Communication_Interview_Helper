from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from ..database import get_database
from ..models.user import UserModel
from ..schemas.user import UserCreate, UserLogin, UserResponse, Token, PasswordChange
from ..utils.auth import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    decode_access_token
)
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Dependency to get the currently authenticated user from JWT token.
    Use this in routes that require authentication.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Decode token
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    # Get email from token
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    
    # Find user in database
    db = get_database()
    user = await db.users.find_one({"email": email})
    
    if user is None:
        raise credentials_exception
    
    return user

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    """
    Register a new user account.
    
    - Checks if email already exists
    - Hashes the password
    - Creates user in database
    - Returns JWT token
    """
    db = get_database()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user with hashed password
    hashed_password = get_password_hash(user.password)
    user_model = UserModel(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password
    )
    
    # Insert into database
    #result = await db.users.insert_one(user_model.dict(by_alias=True))
    result = await db.users.insert_one(user_model.model_dump(by_alias=True))
    
    # Create access token
    access_token = create_access_token(data={"sub": user.email})
    
    # Return token and user info
    user_response = UserResponse(
        id=str(result.inserted_id),
        email=user.email,
        full_name=user.full_name,
        created_at=user_model.created_at,
        sessions_count=0
    )
    
    return Token(access_token=access_token, user=user_response)

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login with email and password.
    
    - Verifies credentials
    - Returns JWT token if valid
    """
    db = get_database()
    
    # Find user by email (OAuth2PasswordRequestForm uses 'username' field for email)
    user = await db.users.find_one({"email": form_data.username})
    
    # Verify user exists and password is correct
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if account is active
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": user["email"]})
    
    # Return token and user info
    user_response = UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user["full_name"],
        created_at=user["created_at"],
        sessions_count=user.get("sessions_count", 0),
        total_practice_time_minutes=user.get("total_practice_time_minutes", 0.0)
    )
    
    return Token(access_token=access_token, user=user_response)

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """
    Get current user's profile information.
    Requires authentication (JWT token in header).
    """
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        full_name=current_user["full_name"],
        created_at=current_user["created_at"],
        sessions_count=current_user.get("sessions_count", 0),
        total_practice_time_minutes=current_user.get("total_practice_time_minutes", 0.0)
    )

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    """
    Change user's password.
    Requires authentication and correct old password.
    """
    db = get_database()
    
    # Verify old password
    if not verify_password(password_data.old_password, current_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password"
        )
    
    # Hash new password
    new_hashed_password = get_password_hash(password_data.new_password)
    
    # Update in database
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "hashed_password": new_hashed_password,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Password changed successfully"}

@router.post("/logout")
async def logout():
    """
    Logout endpoint (client should delete token).
    With JWT, actual logout is handled client-side by deleting the token.
    """
    return {"message": "Logged out successfully"}