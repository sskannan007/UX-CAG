from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import os
import tempfile
import json
from datetime import datetime
import traceback
from werkzeug.utils import secure_filename
from sqlalchemy.orm import Session
from database import get_db
from models import UploadedFile

# Try to import the full pipeline, fallback to simple processor
try:
    from document_processing_pipeline import process_docx_to_json_and_db
    PIPELINE_AVAILABLE = True
except ImportError:
    from simple_docx_processor import simple_docx_to_json as process_docx_to_json_and_db
    PIPELINE_AVAILABLE = False

# Create FastAPI instance
app = FastAPI(
    title="React Bootstrap API",
    description="Backend API for React Bootstrap application",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'docx', 'doc', 'pdf', 'txt', 'json', 'csv', 'xlsx', 'xls'}

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Pydantic models
class ContactMessage(BaseModel):
    name: str
    email: str
    message: str

class User(BaseModel):
    id: Optional[int] = None
    name: str
    email: str

class UploadedFileResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    file_type: str
    uploaded_at: Optional[str] = None
    status: str
    is_assigned: bool
    assigned_to_names: Optional[str] = None
    extracted_json: Optional[dict] = None

class FileAssignmentRequest(BaseModel):
    user_ids: List[int]
    file_ids: List[int]

# In-memory storage (replace with database in production)
users_db = []
messages_db = []
uploaded_files_db = []
file_assignments_db = []

# Routes
@app.get("/")
async def root():
    return {"message": "Welcome to React Bootstrap API"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "API is running"}

@app.get("/api/users", response_model=List[User])
async def get_users():
    return users_db

@app.post("/api/users", response_model=User)
async def create_user(user: User):
    user.id = len(users_db) + 1
    users_db.append(user)
    return user

@app.get("/api/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    for user in users_db:
        if user.id == user_id:
            return user
    raise HTTPException(status_code=404, detail="User not found")

@app.post("/api/contact")
async def submit_contact(message: ContactMessage):
    message_dict = message.dict()
    message_dict["id"] = len(messages_db) + 1
    messages_db.append(message_dict)
    return {"message": "Contact form submitted successfully", "data": message_dict}

@app.get("/api/contact")
async def get_contact_messages():
    return {"messages": messages_db}

@app.get("/api/about")
async def get_about_info():
    return {
        "title": "About Our Application",
        "description": "This is a React Bootstrap application with FastAPI backend",
        "version": "1.0.0",
        "technologies": [
            "React 19.1.1",
            "React Bootstrap 2.10.10",
            "React Router DOM 7.9.1",
            "FastAPI 0.104.1",
            "Python 3.13"
        ]
    }

# Bulk Upload Endpoints
@app.post("/api/bulk-process-documents")
async def bulk_process_documents(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    """Process multiple documents and return results"""
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        results = []
        errors = []
        word_documents = 0
        
        for file in files:
            if file and allowed_file(file.filename):
                try:
                    # Save file temporarily
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(UPLOAD_FOLDER, filename)
                    
                    # Read file content and save
                    content = await file.read()
                    with open(file_path, "wb") as f:
                        f.write(content)
                    
                    # Create database record first
                    db_file = UploadedFile(
                        filename=filename,
                        original_filename=file.filename,
                        file_path=file_path,
                        file_size=len(content),
                        file_type=filename.rsplit('.', 1)[1].lower(),
                        uploaded_at=datetime.now(),
                        status="uploaded"
                    )
                    db.add(db_file)
                    db.commit()
                    db.refresh(db_file)
                    
                    # Process DOCX files through the pipeline
                    if filename.lower().endswith(('.docx', '.doc')):
                        word_documents += 1
                        try:
                            # Use the document processing pipeline
                            pipeline_result = process_docx_to_json_and_db(file_path, db, db_file.id)
                            
                            if pipeline_result['status'] == 'success':
                                # Update the database record with processed status
                                db_file.status = "processed"
                                db_file.extracted_json = pipeline_result['extracted_json']
                                db_file.json_updated_at = datetime.now()
                                db.commit()
                                
                                results.append({
                                    "file_id": db_file.id,
                                    "filename": filename,
                                    "status": "processed",
                                    "data": pipeline_result['extracted_json']
                                })
                            else:
                                # Pipeline failed, mark as error
                                db_file.status = "error"
                                db.commit()
                                errors.append({
                                    "filename": file.filename,
                                    "error": pipeline_result['message'],
                                    "step_failed": "pipeline_processing"
                                })
                                
                        except Exception as pipeline_error:
                            # Pipeline processing failed
                            db_file.status = "error"
                            db.commit()
                            errors.append({
                                "filename": file.filename,
                                "error": str(pipeline_error),
                                "step_failed": "pipeline_processing"
                            })
                    else:
                        # For non-Word documents, just mark as uploaded
                        db_file.status = "uploaded"
                        db.commit()
                        
                        results.append({
                            "file_id": db_file.id,
                            "filename": filename,
                            "status": "uploaded",
                            "data": {"message": "File uploaded successfully"}
                        })
                    
                except Exception as e:
                    errors.append({
                        "filename": file.filename,
                        "error": str(e),
                        "step_failed": "processing"
                    })
                    print(f"Error processing {file.filename}: {str(e)}")
                    traceback.print_exc()
            else:
                errors.append({
                    "filename": file.filename,
                    "error": "File type not allowed",
                    "step_failed": "validation"
                })
        
        return {
            "status": "success",
            "results": results,
            "errors": errors,
            "total_files": len(files),
            "word_documents": word_documents,
            "processed": len(results)
        }
        
    except Exception as e:
        print(f"Bulk processing error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Bulk processing failed: {str(e)}")

@app.get("/api/uploaded-files")
async def get_uploaded_files(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str = Query(""),
    assignment: str = Query(""),
    db: Session = Depends(get_db)
):
    """Get list of uploaded files with pagination and filtering"""
    try:
        # Build query
        query = db.query(UploadedFile)
        
        # Apply search filter
        if search:
            query = query.filter(UploadedFile.filename.contains(search))
        
        # Apply assignment filter (simplified for now)
        if assignment == "assigned":
            # For now, we'll consider files with extracted_json as "assigned"
            query = query.filter(UploadedFile.extracted_json.isnot(None))
        elif assignment == "unassigned":
            query = query.filter(UploadedFile.extracted_json.is_(None))
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        files = query.offset(offset).limit(limit).all()
        
        # Format response
        files_data = []
        for file in files:
            files_data.append({
                "id": file.id,
                "filename": file.filename,
                "original_filename": file.original_filename,
                "file_size": file.file_size,
                "file_type": file.file_type,
                "uploaded_at": file.uploaded_at.isoformat() if file.uploaded_at else None,
                "status": file.status,
                "extracted_json": file.extracted_json
            })
        
        return {
            "files": files_data,
            "total": total_count,
            "page": page,
            "limit": limit,
            "pages": (total_count + limit - 1) // limit
        }
        
    except Exception as e:
        print(f"Error fetching files: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch files: {str(e)}")

@app.get("/api/uploaded-files/{file_id}/content")
async def get_file_content(file_id: int):
    """Get content of a specific file"""
    try:
        file = next((f for f in uploaded_files_db if f["id"] == file_id), None)
        
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        
        content = file["extracted_json"] or {}
        
        return {
            "status": "success",
            "content": content
        }
        
    except Exception as e:
        print(f"Error fetching file content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch file content: {str(e)}")

@app.post("/api/uploaded-files/batch-content")
async def get_batch_file_content(file_ids: List[int]):
    """Get content of multiple files in batch"""
    try:
        if not file_ids:
            raise HTTPException(status_code=400, detail="No file IDs provided")
        
        files_data = []
        for file_id in file_ids:
            file = next((f for f in uploaded_files_db if f["id"] == file_id), None)
            if file:
                files_data.append({
                    "file_id": file["id"],
                    "content": file["extracted_json"] or {}
                })
        
        return {
            "status": "success",
            "files": files_data
        }
        
    except Exception as e:
        print(f"Error fetching batch content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch batch content: {str(e)}")

@app.get("/admin/users/list")
async def get_users_list():
    """Get list of users for assignment"""
    try:
        # Mock users data (replace with database query in production)
        users_data = [
            {"id": 1, "name": "Demo User 1", "email": "user1@example.com", "role_status": "active"},
            {"id": 2, "name": "Demo User 2", "email": "user2@example.com", "role_status": "active"},
            {"id": 3, "name": "Demo User 3", "email": "user3@example.com", "role_status": "inactive"}
        ]
        
        return users_data
        
    except Exception as e:
        print(f"Error fetching users: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

@app.post("/admin/assign-files")
async def assign_files(assignment: FileAssignmentRequest):
    """Assign files to users"""
    try:
        user_ids = assignment.user_ids
        file_ids = assignment.file_ids
        
        if not user_ids or not file_ids:
            raise HTTPException(status_code=400, detail="User IDs and file IDs are required")
        
        created = 0
        for user_id in user_ids:
            for file_id in file_ids:
                # Check if assignment already exists
                existing = next((fa for fa in file_assignments_db 
                               if fa["user_id"] == user_id and fa["file_id"] == file_id), None)
                
                if not existing:
                    file_assignments_db.append({
                        "user_id": user_id,
                        "file_id": file_id,
                        "assigned_at": datetime.now().isoformat()
                    })
                    created += 1
        
        return {
            "status": "success",
            "message": "Files assigned successfully",
            "created": created
        }
        
    except Exception as e:
        print(f"Error assigning files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to assign files: {str(e)}")

@app.get("/users/me")
async def get_current_user():
    """Get current user information"""
    try:
        # For demo purposes, return a mock user
        # In production, you would validate the token and get real user data
        return {
            "id": 1,
            "firstname": "Sarav",
            "lastname": "User",
            "email": "sarav@example.com",
            "role": "admin",
            "permissions": ["bulk_upload:create", "bulk_upload:view"],
            "config": {
                "home": True,
                "dataValidation": True,
                "assignedDocuments": True,
                "bulkUpload": True,
                "admin": True
            }
        }
        
    except Exception as e:
        print(f"Error getting user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
