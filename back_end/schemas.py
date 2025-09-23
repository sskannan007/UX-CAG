from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date, datetime

class UserCreate(BaseModel):
    """Schema for user registration"""
    firstname: str
    lastname: str
    email: EmailStr
    password: str
    dob: Optional[date] = None
    contactno: Optional[str] = None
    place: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gender: Optional[str] = None
    
class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    """Schema for user response (excludes password)"""
    id: int
    firstname: str
    lastname: str
    email: EmailStr
    dob: Optional[date] = None
    contactno: Optional[str] = None
    place: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gender: Optional[str] = None
    role_status: str
    account_created_at: datetime
    
    class Config:
        orm_mode = True

class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"
    
class TokenPayload(BaseModel):
    """Schema for JWT token payload"""
    sub: str  # Subject (user email)
    user_id: int
    role_status: str
    exp: Optional[datetime] = None  # Expiration time

class RoleCreate(BaseModel):
    """Schema for role creation"""
    name: str
    description: Optional[str] = None