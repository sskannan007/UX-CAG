import asyncio
import threading
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import get_db
from models import PasswordResetOTP
import time

class OTPCleanupScheduler:
    def __init__(self, cleanup_interval_minutes: int = 5):
        """
        Initialize OTP cleanup scheduler
        
        Args:
            cleanup_interval_minutes: How often to run cleanup (default: 5 minutes)
        """
        self.cleanup_interval_minutes = cleanup_interval_minutes
        self.is_running = False
        self.cleanup_thread = None
    
    def cleanup_expired_otps(self, db: Session) -> int:
        """Clean up expired OTPs from database"""
        try:
            # Delete all expired OTPs (15 minutes after creation)
            deleted_count = db.query(PasswordResetOTP).filter(
                PasswordResetOTP.expires_at < datetime.utcnow()
            ).delete(synchronize_session=False)
            
            db.commit()
            
            if deleted_count > 0:
                print(f"Cleaned up {deleted_count} expired OTP(s) at {datetime.utcnow()}")
            
            return deleted_count
        except Exception as e:
            print(f"Error cleaning up expired OTPs: {str(e)}")
            db.rollback()
            return 0
    
    def _cleanup_worker(self):
        """Background worker that runs the cleanup periodically"""
        while self.is_running:
            try:
                # Get database session
                db = next(get_db())
                self.cleanup_expired_otps(db)
                db.close()
            except Exception as e:
                print(f"Error in OTP cleanup worker: {str(e)}")
            
            # Wait for the next cleanup interval
            time.sleep(self.cleanup_interval_minutes * 60)
    
    def start_scheduler(self):
        """Start the cleanup scheduler in a background thread"""
        if not self.is_running:
            self.is_running = True
            self.cleanup_thread = threading.Thread(target=self._cleanup_worker, daemon=True)
            self.cleanup_thread.start()
            print(f"OTP cleanup scheduler started (running every {self.cleanup_interval_minutes} minutes)")
    
    def stop_scheduler(self):
        """Stop the cleanup scheduler"""
        if self.is_running:
            self.is_running = False
            if self.cleanup_thread:
                self.cleanup_thread.join(timeout=5)
            print("OTP cleanup scheduler stopped")
    
    def force_cleanup(self):
        """Manually trigger a cleanup (useful for testing or immediate cleanup)"""
        try:
            db = next(get_db())
            deleted_count = self.cleanup_expired_otps(db)
            db.close()
            return deleted_count
        except Exception as e:
            print(f"Error in force cleanup: {str(e)}")
            return 0

# Global instance
otp_cleanup_scheduler = OTPCleanupScheduler(cleanup_interval_minutes=5)