from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Any

from schemas import UserCreate, UserLogin, UserResponse, Token
from database import get_db
from models import User
from security import hash_password, verify_password
from jwt_token import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from password_reset import create_password_reset_otp, verify_otp, reset_password_with_token
from otp_cleanup import otp_cleanup_scheduler

# Create API router for auth endpoints
router = APIRouter(
    prefix="/api/auth",
    tags=["authentication"],
    responses={404: {"description": "Not found"}}
)

# OAuth2 scheme for token based authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@router.post("/register", response_model=UserResponse)
async def register_user(user_data: UserCreate, db: Session = Depends(get_db)) -> Any:
    """
    Register a new user
    
    Args:
        user_data: User data from request body
        db: Database session
        
    Returns:
        UserResponse: Created user data (without password)
        
    Raises:
        HTTPException: If email already exists
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    
    db_user = User(
        firstname=user_data.firstname,
        lastname=user_data.lastname,
        email=user_data.email,
        password=hashed_password,
        dob=user_data.dob,
        contactno=user_data.contactno,
        place=user_data.place,
        city=user_data.city,
        state=user_data.state,
        pincode=user_data.pincode,
        gender=user_data.gender,
        role_status="user"  # Default role status
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Any:
    """
    Login to get access token
    
    Args:
        form_data: OAuth2 password request form
        db: Database session
        
    Returns:
        Token: JWT access token
        
    Raises:
        HTTPException: If invalid credentials
    """
    # Get user by email
    user = db.query(User).filter(User.email == form_data.username).first()
    
    # Check if user exists and password is correct
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Generate access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.email,
        user_id=user.id,
        role_status=user.role_status,
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token-login", response_model=Token)
async def login_with_email_password(user_data: UserLogin, db: Session = Depends(get_db)) -> Any:
    """
    Login with email and password
    
    Args:
        user_data: User login data
        db: Database session
        
    Returns:
        Token: JWT access token
        
    Raises:
        HTTPException: If invalid credentials
    """
    # Get user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    
    # Check if user exists and password is correct
    if not user or not verify_password(user_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Generate access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.email,
        user_id=user.id,
        role_status=user.role_status,
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}
@router.post("/forgot-password")
async def forgot_password(request_data: dict, db: Session = Depends(get_db)) -> Any:
    """
    Send OTP to user's email for password reset
    
    Args:
        request_data: Contains email
        db: Database session
        
    Returns:
        Success message
        
    Raises:
        HTTPException: If user not found or email sending fails
    """
    email = request_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required"
        )
    
    try:
        create_password_reset_otp(db, email)
        return {"message": "OTP sent to your email"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP"
        )

@router.post("/verify-otp")
async def verify_password_reset_otp(request_data: dict, db: Session = Depends(get_db)) -> Any:
    """
    Verify OTP and return reset token
    
    Args:
        request_data: Contains email and otp
        db: Database session
        
    Returns:
        Reset token
        
    Raises:
        HTTPException: If OTP is invalid or expired
    """
    email = request_data.get("email")
    otp = request_data.get("otp")
    
    if not email or not otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and OTP are required"
        )
    
    try:
        reset_token = verify_otp(db, email, otp)
        return {"reset_token": reset_token, "message": "OTP verified successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify OTP"
        )

@router.post("/reset-password")
async def reset_password(request_data: dict, db: Session = Depends(get_db)) -> Any:
    """
    Reset password using verification token
    
    Args:
        request_data: Contains email, token, and new_password
        db: Database session
        
    Returns:
        Success message
        
    Raises:
        HTTPException: If token is invalid or password reset fails
    """
    email = request_data.get("email")
    token = request_data.get("token")
    new_password = request_data.get("new_password")
    
    if not email or not token or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email, token, and new password are required"
        )
    
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )
    
    try:
        reset_password_with_token(db, email, token, new_password)
        return {"message": "Password reset successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )

@router.post("/cleanup-expired-otps")
async def cleanup_expired_otps_endpoint(db: Session = Depends(get_db)) -> Any:
    """
    Manually trigger cleanup of expired OTPs (for testing/admin purposes)
    
    Args:
        db: Database session
        
    Returns:
        Cleanup result message
    """
    try:
        deleted_count = otp_cleanup_scheduler.force_cleanup()
        return {
            "message": f"Cleanup completed successfully",
            "deleted_otps": deleted_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup expired OTPs: {str(e)}"
        )