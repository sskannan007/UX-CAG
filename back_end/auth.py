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