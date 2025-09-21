#!/usr/bin/env python3
"""
Script to clean the database and remove all uploaded file records
"""

from database import SessionLocal
from models import UploadedFile

def clean_database():
    """Remove all records from the uploaded_files table"""
    db = SessionLocal()
    
    try:
        # Delete all existing records
        deleted_count = db.query(UploadedFile).delete()
        db.commit()
        print(f'✅ Deleted {deleted_count} records from database')
        
        # Verify deletion
        remaining_count = db.query(UploadedFile).count()
        print(f'📊 Remaining records: {remaining_count}')
        
        if remaining_count == 0:
            print('🎉 Database cleaned successfully!')
        else:
            print('⚠️  Some records still remain')
            
    except Exception as e:
        print(f'❌ Error: {e}')
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_database()

