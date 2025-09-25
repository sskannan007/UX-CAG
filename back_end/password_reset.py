import smtplib
import random
import string
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from models import PasswordResetOTP, User
from email_settings import email_settings
import jwt
from passlib.context import CryptContext

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def cleanup_expired_otps_simple(db: Session) -> int:
    """
    Simple cleanup function for expired OTPs
    This is used as a fallback when the scheduler is not available
    """
    try:
        # Delete all expired OTPs
        deleted_count = db.query(PasswordResetOTP).filter(
            PasswordResetOTP.expires_at < datetime.utcnow()
        ).delete(synchronize_session=False)
        
        db.commit()
        return deleted_count
    except Exception as e:
        print(f"Error cleaning up expired OTPs: {str(e)}")
        db.rollback()
        return 0

def generate_otp(length: int = 5) -> str:
    """Generate a random OTP of specified length"""
    return ''.join(random.choices(string.digits, k=length))

def send_otp_email(email: str, otp: str) -> bool:
    """Send OTP to user's email"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = f"{email_settings.MAIL_FROM_NAME} <{email_settings.MAIL_FROM}>"
        msg['To'] = email
        msg['Subject'] = "Password Reset Verification Code"
        
        # Email body
        body = f"""
        <html>
        <body>
            <h2>Password Reset Verification</h2>
            <p>You have requested to reset your password for your Proof Box account.</p>
            <p>Your verification code is: <strong style="font-size: 24px; color: #007bff;">{otp}</strong></p>
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <br>
            <p>Best regards,<br>Proof Box Team</p>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        # Connect to server and send email
        server = smtplib.SMTP(email_settings.MAIL_SERVER, email_settings.MAIL_PORT)
        if email_settings.MAIL_STARTTLS:
            server.starttls()
        if email_settings.USE_CREDENTIALS:
            server.login(email_settings.MAIL_USERNAME, email_settings.MAIL_PASSWORD)
        
        text = msg.as_string()
        server.sendmail(email_settings.MAIL_FROM, email, text)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

def create_password_reset_otp(db: Session, email: str) -> str:
    """Create and store OTP for password reset"""
    # Clean up expired OTPs first
    cleanup_expired_otps_simple(db)
    
    # Check if user exists
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise ValueError("User with this email does not exist")
    
    # Generate OTP
    otp = generate_otp()
    
    # Mark any existing unused OTPs as used for this email
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email,
        PasswordResetOTP.is_used == False
    ).update({"is_used": True})
    
    # Create new OTP record
    otp_record = PasswordResetOTP(
        email=email,
        otp_code=otp,
        expires_at=datetime.utcnow() + timedelta(minutes=15),  # 15 minutes expiry
        is_used=False
    )
    
    db.add(otp_record)
    db.commit()
    
    # Send OTP via email
    if not send_otp_email(email, otp):
        raise ValueError("Failed to send OTP email")
    
    return otp

def verify_otp(db: Session, email: str, otp: str) -> str:
    """Verify OTP and return reset token"""
    # Clean up expired OTPs first
    cleanup_expired_otps_simple(db)
    
    # Find valid OTP
    otp_record = db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email,
        PasswordResetOTP.otp_code == otp,
        PasswordResetOTP.is_used == False,
        PasswordResetOTP.expires_at > datetime.utcnow()
    ).first()
    
    if not otp_record:
        raise ValueError("Invalid or expired OTP")
    
    # Mark OTP as used
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.id == otp_record.id
    ).update({"is_used": True})
    db.commit()
    
    # Generate reset token
    token_data = {
        "email": email,
        "exp": datetime.utcnow() + timedelta(minutes=email_settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    
    reset_token = jwt.encode(token_data, email_settings.SECRET_KEY, algorithm=email_settings.ALGORITHM)
    
    return reset_token

def reset_password_with_token(db: Session, email: str, token: str, new_password: str) -> bool:
    """Reset password using verification token"""
    try:
        # Verify token
        payload = jwt.decode(token, email_settings.SECRET_KEY, algorithms=[email_settings.ALGORITHM])
        token_email = payload.get("email")
        
        if token_email != email:
            raise ValueError("Invalid token")
        
        # Find user
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise ValueError("User not found")
        
        # Hash new password
        hashed_password = pwd_context.hash(new_password)
        
        # Update password
        db.query(User).filter(User.email == email).update({"password": hashed_password})
        db.commit()
        
        return True
        
    except jwt.ExpiredSignatureError:
        raise ValueError("Reset token has expired")
    except jwt.JWTError:
        raise ValueError("Invalid reset token")
    except Exception as e:
        raise ValueError(f"Failed to reset password: {str(e)}")

def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)