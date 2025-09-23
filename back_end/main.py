from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Depends, Request
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
import models
from models import UploadedFile, User
from schemas import RoleCreate

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

# Import and include authentication router after app is defined
from auth import router as auth_router
from dependencies import get_current_user, get_current_active_user
app.include_router(auth_router)

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

@app.get("/api/user/me")
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current authenticated user info"""
    user_data = {
        "id": current_user.id,
        "firstname": current_user.firstname,
        "lastname": current_user.lastname,
        "email": current_user.email,
        "dob": current_user.dob,
        "contactno": current_user.contactno,
        "place": current_user.place,
        "city": current_user.city,
        "state": current_user.state,
        "pincode": current_user.pincode,
        "gender": current_user.gender,
        "role_status": current_user.role_status,
    }
    return user_data

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

@app.get("/api/uploaded-files/{file_id}")
async def get_file_details(file_id: int, db: Session = Depends(get_db)):
    """Get details of a specific uploaded file"""
    try:
        file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            "id": file.id,
            "filename": file.filename,
            "original_filename": file.original_filename,
            "file_size": file.file_size,
            "file_type": file.file_type,
            "uploaded_at": file.uploaded_at.isoformat() if file.uploaded_at else None,
            "status": file.status,
            "extracted_json": file.extracted_json
        }
        
    except Exception as e:
        print(f"Error fetching file details: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch file details: {str(e)}")


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


@app.delete("/api/uploaded-files/{file_id}")
async def delete_uploaded_file(file_id: int, db: Session = Depends(get_db)):
    """Delete an uploaded file"""
    try:
        # Find the file in database
        file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete the physical file if it exists
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Warning: Could not delete physical file {file_path}: {str(e)}")
        
        # Delete the database record
        db.delete(file)
        db.commit()
        
        return {
            "status": "success",
            "message": f"File {file.filename} deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting file: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


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


# Validation Workflow Endpoints
@app.post("/api/review-and-submit")
def review_and_submit_changes(
    file_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Review and Submit: Move updated_json to extracted_json (finalize changes)
    """
    try:
        # Get the file record
        file_record = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Check if there are pending changes in updated_json
        if not file_record.updated_json:
            raise HTTPException(status_code=400, detail="No pending changes to submit")
        
        # Move updated_json to extracted_json (finalize the changes)
        file_record.extracted_json = file_record.updated_json
        file_record.json_updated_at = datetime.now(timezone.utc)
        
        # Clear updated_json since changes are now finalized
        file_record.updated_json = None
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Changes have been reviewed and submitted successfully",
            "file_id": file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to submit changes: {str(e)}")

@app.get("/api/validate-json/{file_id}")
def get_validation_json(
    file_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validate: Get updated_json for validation (shows pending changes)
    """
    try:
        # Get the file record
        file_record = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Return updated_json if available, otherwise return extracted_json
        json_data = file_record.updated_json if file_record.updated_json else file_record.extracted_json
        
        if not json_data:
            raise HTTPException(status_code=404, detail="No JSON data available for validation")
        
        return {
            "status": "success",
            "file_id": file_id,
            "filename": file_record.original_filename or file_record.filename,
            "content": json_data,
            "source": "updated_json" if file_record.updated_json else "extracted_json",
            "has_pending_changes": bool(file_record.updated_json)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get validation data: {str(e)}")

@app.post("/api/save-validation-changes")
def save_validation_changes(
    file_id: int,
    updated_json: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save validation changes to updated_json (pending changes)
    """
    try:
        # Get the file record
        file_record = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Save changes to updated_json (pending changes)
        file_record.updated_json = updated_json
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Validation changes saved successfully",
            "file_id": file_id,
            "has_pending_changes": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save validation changes: {str(e)}")

# @app.post("/admin/audit-logs")
# def create_audit_log(
#     payload: AuditLogCreate,
#     request: Request,
#     db: Session = Depends(get_db),
#     current_user: models.User = Depends(get_current_user),
# ):
#     try:
#         client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
#         db_log = models.AuditLog(
#             title=payload.title,
#             old_json=payload.oldJson,
#             new_json=payload.newJson,
#             modified=payload.modified,
#             username=f"{current_user.firstname} {current_user.lastname}" if current_user else None,
#             user_id=current_user.id if current_user else None,
#             ip=client_ip,
#             action=payload.action,
#             file_id=payload.fileId,
#         )
#         db.add(db_log)
        
#         # Optional: mark assignments validated if such a column exists. Ignore if not present.
#         try:
#             result = db.execute(
#                 text("UPDATE user_file_assignments SET validated = 1 WHERE file_id = :file_id"),
#                 {"file_id": payload.fileId}
#             )
#             print(f"Rows affected: {getattr(result, 'rowcount', 'n/a')}")
#         except Exception as _e:
#             # Column may not exist; do not fail audit logging
#             pass
       
#         db.commit()
#         db.refresh(db_log)
#         return {"status": "success", "id": db_log.id}
       
#     except Exception as e:
#         db.rollback()
#         print(f"Error: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Failed to create audit log: {str(e)}")
        
@app.get("/admin/audit-logs")
async def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    state: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    report_period_from: Optional[str] = None,
    report_period_to: Optional[str] = None,
    log_date_from: Optional[str] = None,
    log_date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 100,
):
    try:
        # Calculate offset for pagination
        offset = (page - 1) * limit
        
        # Build optimized query with joins to reduce N+1 queries
        query = db.query(models.AuditLog)
        
        # Apply filters at database level for better performance
        if search:
            query = query.filter(
                or_(
                    models.AuditLog.title.ilike(f"%{search}%"),
                    models.AuditLog.username.ilike(f"%{search}%"),
                    models.AuditLog.action.ilike(f"%{search}%")
                )
            )
        
        if log_date_from:
            try:
                from_date = datetime.strptime(log_date_from, "%Y-%m-%d").date()
                query = query.filter(models.AuditLog.timestamp >= from_date)
            except ValueError:
                pass
                
        if log_date_to:
            try:
                to_date = datetime.strptime(log_date_to, "%Y-%m-%d").date()
                query = query.filter(models.AuditLog.timestamp <= to_date)
            except ValueError:
                pass
        
        # Get total count for pagination info (optimized)
        total_count = query.count()
        
        # Get paginated logs with optimized ordering
        logs = query.order_by(models.AuditLog.timestamp.desc()).offset(offset).limit(limit).all()

        def safe_lower(s: Optional[str]) -> str:
            return (s or "").strip().lower()

        def parse_date(date_str: Optional[str]):
            if not date_str:
                return None
            try:
                # Try ISO first
                return datetime.fromisoformat(date_str).date()
            except Exception:
                pass
            try:
                # Try YYYY-MM-DD
                return datetime.strptime(date_str, "%Y-%m-%d").date()
            except Exception:
                pass
            try:
                # Try DD/MM/YYYY
                return datetime.strptime(date_str, "%d/%m/%Y").date()
            except Exception:
                pass
            try:
                # Try YYYY only -> set to Jan 1st
                if len(date_str) == 4 and date_str.isdigit():
                    return datetime(int(date_str), 1, 1).date()
            except Exception:
                pass
            return None

        def extract_meta(obj: Optional[Dict[str, Any]]) -> Dict[str, Optional[str]]:
            if not obj:
                return {"state": None, "departments": None, "period_from": None, "period_to": None}
            try:
                report = obj
                # New schema: Parts -> PART I -> Inspection_Report
                parts = report.get("Parts") if isinstance(report, dict) else None
                if parts and isinstance(parts, dict):
                    part_i = parts.get("PART I")
                    if part_i and isinstance(part_i, dict):
                        ir = part_i.get("Inspection_Report")
                        if ir and isinstance(ir, dict):
                            report = ir
                rp = (report.get("Reporting_Period") if isinstance(report, dict) else None) or {}
                ip = (report.get("Inspection_Period") if isinstance(report, dict) else None) or {}
                state_name = rp.get("state_name") or ip.get("state_name")
                departments = rp.get("departments") or ip.get("departments")
                pf = rp.get("Period_From") or ip.get("Period_From")
                pt = rp.get("Period_To") or ip.get("Period_To")
                return {
                    "state": state_name,
                    "departments": departments,
                    "period_from": pf,
                    "period_to": pt,
                }
            except Exception:
                return {"state": None, "departments": None, "period_from": None, "period_to": None}

        # Pre-parse filter dates
        rp_from_date = parse_date(report_period_from)
        rp_to_date = parse_date(report_period_to)
        ld_from_date = parse_date(log_date_from)
        ld_to_date = parse_date(log_date_to)

        filtered = []
        for l in logs:
            meta = extract_meta(l.new_json) or extract_meta(l.old_json)
            state_val = safe_lower(meta.get("state"))
            dept_val = safe_lower(meta.get("departments"))

            # Text search across state/department if provided
            if state and safe_lower(state) not in state_val:
                # Allow match also inside department for convenience
                if safe_lower(state) not in dept_val:
                    continue
            if department and safe_lower(department) not in dept_val:
                # Allow match also inside state
                if safe_lower(department) not in state_val:
                    continue
            if search:
                sterm = safe_lower(search)
                hay = " ".join([state_val, dept_val, safe_lower(l.title), safe_lower(l.username), safe_lower(l.action)])
                if sterm not in hay:
                    continue

            # Report period date filtering
            if rp_from_date or rp_to_date:
                pf = parse_date(meta.get("period_from"))
                pt = parse_date(meta.get("period_to"))
                # If we cannot parse period dates, skip this record when period filter is used
                if not pf and not pt:
                    continue
                # Consider a record within range if its period overlaps with the requested range
                candidate_start = pf or pt
                candidate_end = pt or pf
                if rp_from_date and candidate_end and candidate_end < rp_from_date:
                    continue
                if rp_to_date and candidate_start and candidate_start > rp_to_date:
                    continue

            # Log timestamp date filtering
            if (ld_from_date or ld_to_date) and l.timestamp:
                log_date = l.timestamp.date()
                if ld_from_date and log_date < ld_from_date:
                    continue
                if ld_to_date and log_date > ld_to_date:
                    continue

            filtered.append({
                "id": l.id,
                "title": l.title,
                "oldJson": l.old_json,
                "newJson": l.new_json,
                "modified": l.modified,
                "username": l.username,
                "ip": l.ip,
                "action": l.action,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "fileId": l.file_id,
                # Word document HTML for comparison
                # Expose meta for UI
                "state": meta.get("state"),
                "departments": meta.get("departments"),
                "reportPeriodFrom": meta.get("period_from"),
                "reportPeriodTo": meta.get("period_to"),
            })

        return {
            "logs": filtered,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list audit logs: {str(e)}")

# --- Assign files to users API ---
class AssignFilesPayload(BaseModel):
    user_ids: List[int]
    file_ids: List[int]


@app.get("/admin/users/all")
def list_all_users(db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.id.asc()).all()
    return [
        {
            "id": u.id,
            "name": f"{(u.firstname or '').strip()} {(u.lastname or '').strip()}".strip() or f"User {u.id}",
            "email": u.email,
            "role_status": u.role_status,
            "contactno": u.contactno,
            "place": u.place,
            "city": u.city,
            "state": u.state,
            "pincode": u.pincode,
            "gender": u.gender,
            "account_created_at": u.account_created_at.isoformat() if hasattr(u.account_created_at, 'isoformat') else None
        }
        for u in users
    ]


@app.get("/admin/files/all")
def list_all_files(db: Session = Depends(get_db)):
    files = db.query(models.UploadedFile).order_by(models.UploadedFile.uploaded_at.desc()).all()
    return [
        {
            "id": f.id,
            "filename": f.filename,
            "type": f.file_type,
            "size": f.file_size,
            "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,
        }
        for f in files
    ]


@app.post("/admin/assign-files")
def assign_files(payload: AssignFilesPayload, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not payload.user_ids or not payload.file_ids:
        raise HTTPException(status_code=400, detail="user_ids and file_ids are required")

    try:
        # Deduplicate inputs
        user_ids = sorted(set(int(uid) for uid in payload.user_ids))
        file_ids = sorted(set(int(fid) for fid in payload.file_ids))

        # Validate existence
        existing_users = {u.id for u in db.query(models.User).filter(models.User.id.in_(user_ids)).all()}
        existing_files = {f.id for f in db.query(models.UploadedFile).filter(models.UploadedFile.id.in_(file_ids)).all()}
        missing_users = [uid for uid in user_ids if uid not in existing_users]
        missing_files = [fid for fid in file_ids if fid not in existing_files]
        if missing_users or missing_files:
            raise HTTPException(status_code=400, detail=f"Invalid IDs. Missing users: {missing_users}, Missing files: {missing_files}")

        # Insert or ignore duplicates
        created = 0
        for uid in user_ids:
            for fid in file_ids:
                exists = db.query(models.UserFileAssignment).filter(
                    models.UserFileAssignment.user_id == uid,
                    models.UserFileAssignment.file_id == fid,
                ).first()
                if exists:
                    continue
                assignment = models.UserFileAssignment(user_id=uid, file_id=fid, assigned_by=current_user.id if current_user else None)
                db.add(assignment)
                created += 1

        db.commit()
        return {"status": "success", "created": created}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to assign files: {str(e)}")

@app.post("/admin/roles/update")
def update_role_permissions(role_data: RoleCreate, db: Session = Depends(get_db)):
    # Find the role
    db_role = db.query(models.Role).filter(models.Role.name == role_data.name).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    # Remove existing permissions
    db.query(models.RoleMenu).filter(models.RoleMenu.role_id == db_role.id).delete()
    # Add new permissions
    if role_data.permissions:
        menus = db.query(models.Menu).filter(models.Menu.is_active == True).all()
        for menu in menus:
            menu_permissions = role_data.permissions.get(menu.name, {})
            if menu_permissions:
                can_view = menu_permissions.get('view', False)
                can_create = menu_permissions.get('create', False)
                can_update = menu_permissions.get('update', False)
                can_delete = menu_permissions.get('delete', False)
                role_menu = models.RoleMenu(
                    role_id=db_role.id,
                    menu_id=menu.id,
                    can_view=can_view,
                    can_create=can_create,
                    can_update=can_update,
                    can_delete=can_delete
                )
                db.add(role_menu)
        db.commit()
    return {"message": "Role permissions updated successfully"}

# Get assigned files for a specific user
@app.get("/api/users/{user_id}/assigned-files")
async def get_user_assigned_files(user_id: int, db: Session = Depends(get_db)):
    """Get list of files assigned to a specific user"""
    try:
        # Get all file assignments for the user
        assignments = db.query(models.UserFileAssignment).filter(
            models.UserFileAssignment.user_id == user_id
        ).all()
        
        assigned_files = []
        for assignment in assignments:
            # Get the file details
            file_record = db.query(models.UploadedFile).filter(
                models.UploadedFile.id == assignment.file_id
            ).first()
            
            if file_record:
                assigned_files.append({
                    "id": file_record.id,
                    "filename": file_record.filename,
                    "size": file_record.file_size,
                    "type": file_record.file_type,
                    "uploaded_at": file_record.uploaded_at.isoformat(),
                    "assigned_at": assignment.assigned_at.isoformat(),
                    "assigned_by": assignment.assigned_by
                })
        
        return {
            "status": "success",
            "user_id": user_id,
            "assigned_files": assigned_files,
            "total_count": len(assigned_files)
        }
        
    except Exception as e:
        print(f"Error fetching assigned files for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch assigned files: {str(e)}")

# Get assigned files for current user
@app.get("/api/my-assigned-files")
async def get_my_assigned_files(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get list of files assigned to the current authenticated user"""
    try:
        # Get all file assignments for the current user
        assignments = db.query(models.UserFileAssignment).filter(
            models.UserFileAssignment.user_id == current_user.id
        ).all()
        
        assigned_files = []
        for assignment in assignments:
            # Get the file details
            file_record = db.query(models.UploadedFile).filter(
                models.UploadedFile.id == assignment.file_id
            ).first()
            
            if file_record:
                # Get the name of the admin who assigned the file
                assigned_by_user = db.query(models.User).filter(
                    models.User.id == assignment.assigned_by
                ).first()
                
                assigned_files.append({
                    "id": file_record.id,
                    "filename": file_record.filename,
                    "size": file_record.file_size,
                    "type": file_record.file_type,
                    "uploaded_at": file_record.uploaded_at.isoformat(),
                    "assigned_at": assignment.assigned_at.isoformat(),
                    "assigned_by_name": f"{assigned_by_user.firstname} {assigned_by_user.lastname}" if assigned_by_user else "Unknown Admin",
                    "validated": bool(assignment.validated)
                })
        
        return {
            "status": "success",
            "assigned_files": assigned_files,
            "total_count": len(assigned_files)
        }
        
    except Exception as e:
        print(f"Error fetching assigned files for current user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch assigned files: {str(e)}") 

@app.get("/admin/check-missing-uploaded-files")
def check_missing_uploaded_files(db: Session = Depends(get_db)):
    """Return a list of uploaded_files DB rows where the file_path does not exist on disk."""
    files = db.query(models.UploadedFile).all()
    missing = []
    for f in files:
        # Check main file
        if f.file_path and not os.path.exists(f.file_path):
            missing.append({
                "id": f.id,
                "filename": f.filename,
                "file_path": f.file_path,
                "type": "main"
            })
        # Check associated JSON (if present) - JSON is now stored in database, not as separate files
        # This section is kept for backward compatibility but JSON files are no longer stored separately
        pass
    return {"missing_files": missing, "count": len(missing)} 

@app.get("/admin/file-assignments")
def get_file_assignments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get all file assignments to check which files are assigned"""
    try:
        # Query to get all file assignments
        assignments = db.query(models.UserFileAssignment).all()
        
        # Convert to list of dictionaries
        assignment_list = []
        for assignment in assignments:
            assignment_list.append({
                "file_id": assignment.file_id,
                "user_id": assignment.user_id,
                "assigned_at": assignment.assigned_at,
                "validated": assignment.validated
            })
        
        return {
            "status": "success",
            "assignments": assignment_list
        }
        
    except Exception as e:
        print(f"Error fetching file assignments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch file assignments: {str(e)}")

@app.put("/api/update-validation-status")
def update_validation_status(
    file_id: int,
    validated: bool,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update validation status for a file assignment"""
    try:
        # Find the file assignment for the current user and file
        assignment = db.query(models.UserFileAssignment).filter(
            models.UserFileAssignment.user_id == current_user.id,
            models.UserFileAssignment.file_id == file_id
        ).first()
        
        if not assignment:
            raise HTTPException(status_code=404, detail="File assignment not found for this user")
        
        # Update the validation status (convert boolean to integer)
        assignment.validated = 1 if validated else 0
        db.commit()
        db.refresh(assignment)
        
        return {
            "status": "success",
            "message": f"Validation status updated to {'validated' if validated else 'non-validated'}",
            "file_id": file_id,
            "validated": validated
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error updating validation status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update validation status: {str(e)}")

# Data Validation Feedback API Endpoints

class FeedbackCreateRequest(BaseModel):
    file_id: Optional[int] = None
    severity: str  # 'high', 'moderate', 'low'
    issue_description: str
    field_path: Optional[str] = None
    field_value: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: int
    user_id: int
    file_id: Optional[int]
    severity: str
    issue_description: str
    field_path: Optional[str]
    field_value: Optional[str]
    status: str
    created_at: datetime
    user_name: Optional[str] = None
    file_name: Optional[str] = None

@app.post("/api/data-validation-feedback", response_model=FeedbackResponse)
def create_data_validation_feedback(
    feedback_data: FeedbackCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new data validation feedback entry"""
    try:
        # Validate severity level
        if feedback_data.severity not in ['high', 'moderate', 'low']:
            raise HTTPException(status_code=400, detail="Severity must be 'high', 'moderate', or 'low'")
        
        # Create feedback entry
        feedback = models.DataValidationFeedback(
            user_id=current_user.id,
            file_id=feedback_data.file_id,
            severity=feedback_data.severity,
            issue_description=feedback_data.issue_description,
            field_path=feedback_data.field_path,
            field_value=feedback_data.field_value
        )
        
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        
        # Create activity log entry for feedback submission
        try:
            # Get file name and metadata if file_id is provided
            file_name = None
            period = None
            department = None
            state = None
            
            if feedback_data.file_id:
                file_obj = db.query(models.UploadedFile).filter(models.UploadedFile.id == feedback_data.file_id).first()
                if file_obj:
                    file_name = file_obj.original_filename
                    
                    # Try to extract metadata from JSON if available
                    if file_obj.updated_json:
                        try:
                            json_data = file_obj.updated_json
                            if isinstance(json_data, dict):
                                # Extract common fields from inspection reports
                                period_fields = ['inspection_period', 'period', 'financial_period', 'year']
                                for field in period_fields:
                                    if json_data.get(field):
                                        period = str(json_data[field])
                                        break
                                
                                dept_fields = ['department', 'dept', 'division', 'ministry']
                                for field in dept_fields:
                                    if json_data.get(field):
                                        department = str(json_data[field])
                                        break
                                
                                state_fields = ['state', 'state_name', 'location']
                                for field in state_fields:
                                    if json_data.get(field):
                                        state = str(json_data[field])
                                        break
                        except Exception as e:
                            print(f"Error extracting metadata from JSON: {e}")
            
            # Create activity log entry
            activity_log = models.ActivityLog(
                user_id=current_user.id,
                file_id=feedback_data.file_id,
                activity_type='feedback',
                file_name=file_name,
                period=period,
                department=department,
                state=state,
                modification_count=0,
                feedback_count=1,
                details=feedback_data.issue_description
            )
            
            db.add(activity_log)
            db.commit()
            print(f"Activity log created for feedback submission by user {current_user.id}")
            
        except Exception as e:
            print(f"Error creating activity log for feedback: {e}")
            # Don't fail the feedback creation if activity log fails
            # The feedback was already committed, so we don't need to rollback
        
        # Get user name for response
        user_name = f"{current_user.firstname} {current_user.lastname}".strip()
        
        return FeedbackResponse(
            id=feedback.id,
            user_id=feedback.user_id,
            file_id=feedback.file_id,
            severity=feedback.severity,
            issue_description=feedback.issue_description,
            field_path=feedback.field_path,
            field_value=feedback.field_value,
            status=feedback.status,
            created_at=feedback.created_at,
            user_name=user_name,
            file_name=file_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error creating feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create feedback: {str(e)}")

@app.get("/api/data-validation-feedback", response_model=List[FeedbackResponse])
def get_data_validation_feedback(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status_filter: Optional[str] = None,
    severity_filter: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get data validation feedback entries"""
    try:
        query = db.query(models.DataValidationFeedback)
        
        # Apply filters
        if status_filter:
            query = query.filter(models.DataValidationFeedback.status == status_filter)
        if severity_filter:
            query = query.filter(models.DataValidationFeedback.severity == severity_filter)
        
        # Apply date filters
        if date_from:
            try:
                from_date = datetime.strptime(date_from, "%Y-%m-%d").date()
                query = query.filter(models.DataValidationFeedback.created_at >= from_date)
            except ValueError:
                pass
        if date_to:
            try:
                to_date = datetime.strptime(date_to, "%Y-%m-%d").date()
                # Add one day to include the end date
                to_date = to_date + timedelta(days=1)
                query = query.filter(models.DataValidationFeedback.created_at < to_date)
            except ValueError:
                pass
        
        # If user is not superadmin or admin, only show their own feedback
        user_roles = [ur.role.name for ur in current_user.user_roles]
        if "superadmin" not in user_roles and "admin" not in user_roles:
            query = query.filter(models.DataValidationFeedback.user_id == current_user.id)
        
        feedback_entries = query.order_by(models.DataValidationFeedback.created_at.desc()).all()
        
        result = []
        for feedback in feedback_entries:
            # Get user name
            user = db.query(models.User).filter(models.User.id == feedback.user_id).first()
            user_name = f"{user.firstname} {user.lastname}".strip() if user else "Unknown User"
            
            # Get file name
            file_name = None
            if feedback.file_id:
                file_obj = db.query(models.UploadedFile).filter(models.UploadedFile.id == feedback.file_id).first()
                if file_obj:
                    file_name = file_obj.original_filename
            
            result.append(FeedbackResponse(
                id=feedback.id,
                user_id=feedback.user_id,
                file_id=feedback.file_id,
                severity=feedback.severity,
                issue_description=feedback.issue_description,
                field_path=feedback.field_path,
                field_value=feedback.field_value,
                status=feedback.status,
                created_at=feedback.created_at,
                user_name=user_name,
                file_name=file_name
            ))
        
        return result
        
    except Exception as e:
        print(f"Error fetching feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch feedback: {str(e)}")

@app.put("/api/data-validation-feedback/{feedback_id}")
def update_feedback_status(
    feedback_id: int,
    status: str,
    admin_notes: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update feedback status (admin only)"""
    try:
        # Check if user is superadmin or admin
        user_roles = [ur.role.name for ur in current_user.user_roles]
        if "superadmin" not in user_roles and "admin" not in user_roles:
            raise HTTPException(status_code=403, detail="Only SuperAdmin or Admin can update feedback status")
        
        # Validate status
        if status not in ['pending', 'reviewed', 'resolved']:
            raise HTTPException(status_code=400, detail="Status must be 'pending', 'reviewed', or 'resolved'")
        
        # Find feedback entry
        feedback = db.query(models.DataValidationFeedback).filter(
            models.DataValidationFeedback.id == feedback_id
        ).first()
        
        if not feedback:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        # Update feedback
        feedback.status = status
        feedback.reviewed_by = current_user.id
        feedback.reviewed_at = datetime.now()
        feedback.admin_notes = admin_notes
        
        db.commit()
        db.refresh(feedback)
        
        return {
            "status": "success",
            "message": f"Feedback status updated to {status}",
            "feedback_id": feedback_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error updating feedback status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update feedback status: {str(e)}")

@app.get("/api/data-validation-feedback/count")
def get_feedback_count(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get count of feedback entries by status"""
    try:
        query = db.query(models.DataValidationFeedback)
        
        # If user is not superadmin or admin, only count their own feedback
        user_roles = [ur.role.name for ur in current_user.user_roles]
        if "superadmin" not in user_roles and "admin" not in user_roles:
            query = query.filter(models.DataValidationFeedback.user_id == current_user.id)
        
        total = query.count()
        pending = query.filter(models.DataValidationFeedback.status == "pending").count()
        reviewed = query.filter(models.DataValidationFeedback.status == "reviewed").count()
        resolved = query.filter(models.DataValidationFeedback.status == "resolved").count()
        
        return {
            "total": total,
            "pending": pending,
            "reviewed": reviewed,
            "resolved": resolved
        }
        
    except Exception as e:
        print(f"Error counting feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to count feedback: {str(e)}")

# Add compute-diffs endpoint for better performance
@app.post("/api/compute-diffs")
async def compute_diffs(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Compute differences between old and new JSON for data validation"""
    try:
        data = await request.json()
        old_json = data.get('oldJson', {})
        new_json = data.get('newJson', {})
        file_id = data.get('fileId')
        
        # Compute diffs efficiently
        diffs = compute_json_diffs(old_json, new_json)
        
        # Convert diffs to modified format for audit logs
        modified = []
        for diff in diffs:
            modified.append({
                'path': diff.get('path', ''),
                'oldValue': diff.get('oldValue'),
                'newValue': diff.get('newValue')
            })
        
        return {
            "success": True,
            "diffs": diffs,
            "modified": modified,
            "total_changes": len(diffs)
        }
        
    except Exception as e:
        print(f"Error computing diffs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compute differences: {str(e)}"
        )

def compute_json_diffs(old_obj, new_obj, base_path=""):
    """Efficiently compute differences between two JSON objects"""
    diffs = []
    
    if old_obj == new_obj:
        return diffs
    
    if type(old_obj) != type(new_obj):
        diffs.append({
            "path": base_path,
            "oldValue": old_obj,
            "newValue": new_obj,
            "type": "type_change"
        })
        return diffs
    
    if isinstance(old_obj, dict):
        all_keys = set(old_obj.keys()) | set(new_obj.keys())
        for key in all_keys:
            old_val = old_obj.get(key)
            new_val = new_obj.get(key)
            current_path = f"{base_path}.{key}" if base_path else key
            
            if key not in old_obj:
                diffs.append({
                    "path": current_path,
                    "oldValue": None,
                    "newValue": new_val,
                    "type": "added"
                })
            elif key not in new_obj:
                diffs.append({
                    "path": current_path,
                    "oldValue": old_val,
                    "newValue": None,
                    "type": "removed"
                })
            else:
                diffs.extend(compute_json_diffs(old_val, new_val, current_path))
    
    elif isinstance(old_obj, list):
        max_len = max(len(old_obj), len(new_obj))
        for i in range(max_len):
            current_path = f"{base_path}[{i}]"
            old_val = old_obj[i] if i < len(old_obj) else None
            new_val = new_obj[i] if i < len(new_obj) else None
            
            if i >= len(old_obj):
                diffs.append({
                    "path": current_path,
                    "oldValue": None,
                    "newValue": new_val,
                    "type": "added"
                })
            elif i >= len(new_obj):
                diffs.append({
                    "path": current_path,
                    "oldValue": old_val,
                    "newValue": None,
                    "type": "removed"
                })
            else:
                diffs.extend(compute_json_diffs(old_val, new_val, current_path))
    
    else:
        # Primitive values
        if old_obj != new_obj:
            diffs.append({
                "path": base_path,
                "oldValue": old_obj,
                "newValue": new_obj,
                "type": "modified"
            })
    
    return diffs

# Inspection Report API Endpoints


@app.get("/inspection-reports")
async def get_inspection_reports(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Get all uploaded files for inspection period"""
    try:
        # Get uploaded files with their associated JSON files
        uploaded_files = db.query(models.UploadedFile).offset(skip).limit(limit).all()
        
        reports = []
        for file in uploaded_files:
            # Get the latest audit log for this file to check if there's an updated JSON
            latest_audit = db.query(models.AuditLog).filter(
                models.AuditLog.file_id == file.id
            ).order_by(models.AuditLog.timestamp.desc()).first()
            
            # Get user info
            user = db.query(models.User).filter(models.User.id == file.uploaded_by).first()
            
            # Handle user name display
            uploaded_by_name = "Unknown"
            if user:
                firstname = user.firstname or ""
                lastname = user.lastname or ""
                if firstname and lastname:
                    uploaded_by_name = f"{firstname} {lastname}"
                elif firstname:
                    uploaded_by_name = firstname
                elif lastname:
                    uploaded_by_name = lastname
                else:
                    uploaded_by_name = user.email or "Unknown"
            
            reports.append({
                "id": file.id,
                "filename": file.original_filename,
                "file_path": file.file_path,
                "file_size": file.file_size,
                "file_type": file.file_type,
                "uploaded_at": file.uploaded_at.isoformat() if file.uploaded_at else None,
                "uploaded_by": uploaded_by_name,
                "status": file.status,
                "has_json": bool(file.extracted_json),
                "json_filename": f"{file.original_filename}.json" if file.extracted_json else None,
                "json_file_path": None,  # JSON is stored in database, not as separate files
                "json_uploaded_at": file.json_updated_at.isoformat() if file.json_updated_at else None,
                "has_updated_json": bool(getattr(file, 'updated_json', None)) or (latest_audit is not None and latest_audit.new_json is not None),
                "last_updated": latest_audit.timestamp.isoformat() if latest_audit else None
            })
        
        return {
            "success": True,
            "reports": reports,
            "total": len(reports)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch inspection reports: {str(e)}")

@app.get("/inspection-reports/{report_id}")
async def get_inspection_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get specific inspection report by ID"""
    try:
        report = db.query(models.InspectionReport).filter(models.InspectionReport.id == report_id).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Inspection report not found")
        
        return {
            "success": True,
            "report": {
                "id": report.id,
                "filename": report.filename,
                "status": report.status,
                "created_at": report.created_at.isoformat() if report.created_at else None,
                "updated_at": report.updated_at.isoformat() if report.updated_at else None,
                "uploaded_by": report.uploaded_by,
                "has_approved_json": report.approved_json is not None
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch inspection report: {str(e)}")

@app.get("/inspection-reports/{report_id}/json/{file_type}")
async def get_inspection_report_json(
    report_id: int,
    file_type: str,  # original_json, updated_json
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get JSON data from uploaded files (for metadata extraction)"""
    try:
        uploaded_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == report_id).first()
        
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        if file_type == "original_json":
            # Get the original JSON file from database
            if not uploaded_file.extracted_json:
                # Try to get the latest JSON from audit logs as fallback
                latest_audit = db.query(models.AuditLog).filter(
                    models.AuditLog.file_id == uploaded_file.id,
                    models.AuditLog.old_json.isnot(None)
                ).order_by(models.AuditLog.timestamp.desc()).first()
                
                if not latest_audit or not latest_audit.old_json:
                    raise HTTPException(status_code=404, detail="Original JSON data not found")
                
                json_data = latest_audit.old_json
            else:
                json_data = uploaded_file.extracted_json
            
            return json_data
            
        elif file_type == "updated_json":
            # Get the updated JSON file from database
            json_obj = getattr(uploaded_file, 'updated_json', None)
            if json_obj is None:
                # Fallback to the latest updated JSON from audit logs
                latest_audit = db.query(models.AuditLog).filter(
                    models.AuditLog.file_id == uploaded_file.id,
                    models.AuditLog.new_json.isnot(None)
                ).order_by(models.AuditLog.timestamp.desc()).first()
                
                if not latest_audit or not latest_audit.new_json:
                    raise HTTPException(status_code=404, detail="Updated JSON data not found")
                
                json_data = latest_audit.new_json
            else:
                json_data = json_obj
            
            return json_data
            
        else:
            raise HTTPException(status_code=400, detail="Invalid file type. Use 'original_json' or 'updated_json'")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting JSON data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get JSON data: {str(e)}")

@app.get("/inspection-reports/{report_id}/download/{file_type}")
async def download_inspection_report_file(
    report_id: int,
    file_type: str,  # word, original_json, updated_json
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Download specific file from uploaded files"""
    try:
        uploaded_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == report_id).first()
        
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        if file_type == "word":
            # Download the original Word document
            if not os.path.exists(uploaded_file.file_path):
                raise HTTPException(status_code=404, detail="Word file not found on server")
            
            filename = uploaded_file.original_filename or uploaded_file.filename
            # Choose appropriate media type based on extension
            lower_name = (filename or "").lower()
            if lower_name.endswith('.docx'):
                media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif lower_name.endswith('.doc'):
                media_type = "application/msword"
            else:
                media_type = uploaded_file.file_type or "application/octet-stream"
            
            return FileResponse(
                path=uploaded_file.file_path,
                filename=filename,
                media_type=media_type
            )
            
        elif file_type == "original_json":
            # Download the original JSON file from database
            if not uploaded_file.extracted_json:
                # Try to get the latest JSON from audit logs as fallback
                latest_audit = db.query(models.AuditLog).filter(
                    models.AuditLog.file_id == uploaded_file.id,
                    models.AuditLog.old_json.isnot(None)
                ).order_by(models.AuditLog.timestamp.desc()).first()
                
                if not latest_audit or not latest_audit.old_json:
                    raise HTTPException(status_code=404, detail="Original JSON data not found")
                
                json_data = latest_audit.old_json
            else:
                json_data = uploaded_file.extracted_json
            
            # Create a temporary JSON file
            import tempfile
            import json
            
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
            json.dump(json_data, temp_file, indent=2, ensure_ascii=False)
            temp_file.close()
            
            filename = f"{uploaded_file.original_filename.replace('.docx', '').replace('.doc', '')}_extracted.json"
            media_type = "application/json"
            
            return FileResponse(
                path=temp_file.name,
                filename=filename,
                media_type=media_type
            )
            
        elif file_type == "updated_json":
            # Prefer the updated_json stored on the file row
            json_obj = getattr(uploaded_file, 'updated_json', None)
            if json_obj is None:
                # Fallback to the latest updated JSON from audit logs
                latest_audit = db.query(models.AuditLog).filter(
                    models.AuditLog.file_id == uploaded_file.id,
                    models.AuditLog.new_json.isnot(None)
                ).order_by(models.AuditLog.timestamp.desc()).first()
                if not latest_audit or not latest_audit.new_json:
                    raise HTTPException(status_code=404, detail="Updated JSON not found")
                json_obj = latest_audit.new_json
            
            # Create temporary file with the updated JSON
            import tempfile
            import json
            
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
            json.dump(json_obj, temp_file, indent=2, ensure_ascii=False)
            temp_file.close()
            
            filename = f"updated_{uploaded_file.original_filename.replace('.docx', '').replace('.doc', '')}.json"
            
            return FileResponse(
                path=temp_file.name,
                filename=filename,
                media_type="application/json"
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid file type")
    except HTTPException as http_exc:
        # Preserve specific HTTP errors like 404/400
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")



@app.delete("/inspection-reports/{report_id}")
async def delete_inspection_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete uploaded file"""
    try:
        uploaded_file = db.query(models.UploadedFile).filter(models.UploadedFile.id == report_id).first()
        
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete the actual files from disk
        if os.path.exists(uploaded_file.file_path):
            os.remove(uploaded_file.file_path)
        
        # JSON data is stored in database, no separate file to delete
        
        # Delete from database
        db.delete(uploaded_file)
        db.commit()
        
        return {
            "success": True,
            "message": "File deleted successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

# Data Validation Draft API Endpoints

class DraftCreateRequest(BaseModel):
    file_id: Optional[int] = None
    draft_name: str
    extracted_data: Optional[dict] = None
    working_json: Optional[dict] = None
    pending_changes: Optional[dict] = None

class DraftResponse(BaseModel):
    id: int
    user_id: int
    file_id: Optional[int] = None
    draft_name: str
    extracted_data: Optional[dict] = None
    working_json: Optional[dict] = None
    pending_changes: Optional[dict] = None
    last_saved: datetime
    created_at: datetime
    user_name: str
    file_name: Optional[str] = None

@app.post("/api/data-validation-drafts", response_model=DraftResponse)
def create_data_validation_draft(
    draft_data: DraftCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new data validation draft"""
    try:
        # Check if draft with same name already exists for this user and file
        existing_draft = db.query(models.DataValidationDraft).filter(
            models.DataValidationDraft.user_id == current_user.id,
            models.DataValidationDraft.file_id == draft_data.file_id,
            models.DataValidationDraft.draft_name == draft_data.draft_name
        ).first()
        
        if existing_draft:
            # Update existing draft
            existing_draft.extracted_data = draft_data.extracted_data
            existing_draft.working_json = draft_data.working_json
            existing_draft.pending_changes = draft_data.pending_changes
            existing_draft.last_saved = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing_draft)
            
            # Activity log creation for draft_save is disabled
            # No longer creating activity logs for draft save operations
            
            # Get file name for response
            file_name = None
            if draft_data.file_id:
                file_obj = db.query(models.UploadedFile).filter(models.UploadedFile.id == draft_data.file_id).first()
                if file_obj:
                    file_name = file_obj.original_filename
            
            # Get user name for response
            user_name = f"{current_user.firstname} {current_user.lastname}".strip()
            
            return DraftResponse(
                id=existing_draft.id,
                user_id=existing_draft.user_id,
                file_id=existing_draft.file_id,
                draft_name=existing_draft.draft_name,
                extracted_data=existing_draft.extracted_data,
                working_json=existing_draft.working_json,
                pending_changes=existing_draft.pending_changes,
                last_saved=existing_draft.last_saved,
                created_at=existing_draft.created_at,
                user_name=user_name,
                file_name=file_name
            )
        
        # Create new draft with validation
        print(f"Creating new draft for user {current_user.id}, file {draft_data.file_id}")
        print(f"Draft name: {draft_data.draft_name}")
        print(f"Has extracted_data: {bool(draft_data.extracted_data)}")
        print(f"Has working_json: {bool(draft_data.working_json)}")
        print(f"Has pending_changes: {bool(draft_data.pending_changes)}")
        
        draft = models.DataValidationDraft(
            user_id=current_user.id,
            file_id=draft_data.file_id,
            draft_name=draft_data.draft_name,
            extracted_data=draft_data.extracted_data,
            working_json=draft_data.working_json,
            pending_changes=draft_data.pending_changes
        )
        
        db.add(draft)
        db.commit()
        db.refresh(draft)
        
        print(f"Draft created successfully with ID: {draft.id}")
        
        # Clean up old autosaves (keep only last 5 per file)
        if draft_data.draft_name.startswith('Autosave_'):
            try:
                # Get all autosaves for this file and user, ordered by creation time
                autosaves = db.query(models.DataValidationDraft).filter(
                    models.DataValidationDraft.user_id == current_user.id,
                    models.DataValidationDraft.file_id == draft_data.file_id,
                    models.DataValidationDraft.draft_name.like('Autosave_%')
                ).order_by(models.DataValidationDraft.created_at.desc()).all()
                
                # Keep only the last 5 autosaves, delete the rest
                if len(autosaves) > 5:
                    for old_autosave in autosaves[5:]:
                        print(f"Deleting old autosave: {old_autosave.draft_name}")
                        db.delete(old_autosave)
                    db.commit()
                    print(f"Cleaned up {len(autosaves) - 5} old autosaves")
            except Exception as e:
                print(f"Error cleaning up old autosaves: {e}")
                # Don't fail the draft creation if cleanup fails
        
        # Activity log creation for draft_save is disabled
        # No longer creating activity logs for draft save operations
        
        # Get file name for response
        file_name = None
        if draft_data.file_id:
            file_obj = db.query(models.UploadedFile).filter(models.UploadedFile.id == draft_data.file_id).first()
            if file_obj:
                file_name = file_obj.original_filename
        
        # Get user name for response
        user_name = f"{current_user.firstname} {current_user.lastname}".strip()
        
        return DraftResponse(
            id=draft.id,
            user_id=draft.user_id,
            file_id=draft.file_id,
            draft_name=draft.draft_name,
            extracted_data=draft.extracted_data,
            working_json=draft.working_json,
            pending_changes=draft.pending_changes,
            last_saved=draft.last_saved,
            created_at=draft.created_at,
            user_name=user_name,
            file_name=file_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error creating draft: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create draft: {str(e)}")

@app.get("/api/data-validation-drafts", response_model=List[DraftResponse])
def get_data_validation_drafts(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    file_id: Optional[int] = None
):
    """Get all drafts for the current user, optionally filtered by file_id"""
    try:
        query = db.query(models.DataValidationDraft).filter(
            models.DataValidationDraft.user_id == current_user.id
        )
        
        if file_id:
            query = query.filter(models.DataValidationDraft.file_id == file_id)
        
        drafts = query.order_by(models.DataValidationDraft.last_saved.desc()).all()
        
        # Get user name for response
        user_name = f"{current_user.firstname} {current_user.lastname}".strip()
        
        result = []
        for draft in drafts:
            # Get file name if file_id is provided
            file_name = None
            if draft.file_id:
                file_obj = db.query(models.UploadedFile).filter(models.UploadedFile.id == draft.file_id).first()
                if file_obj:
                    file_name = file_obj.original_filename
            
            # Debug logging for draft data
            print(f"Draft {draft.id}: {draft.draft_name}")
            print(f"  - Has extracted_data: {bool(draft.extracted_data)}")
            print(f"  - Has working_json: {bool(draft.working_json)}")
            print(f"  - Has pending_changes: {bool(draft.pending_changes)}")
            print(f"  - Last saved: {draft.last_saved}")
            
            result.append(DraftResponse(
                id=draft.id,
                user_id=draft.user_id,
                file_id=draft.file_id,
                draft_name=draft.draft_name,
                extracted_data=draft.extracted_data,
                working_json=draft.working_json,
                pending_changes=draft.pending_changes,
                last_saved=draft.last_saved,
                created_at=draft.created_at,
                user_name=user_name,
                file_name=file_name
            ))
        
        print(f"Returning {len(result)} drafts for user {current_user.id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching drafts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch drafts: {str(e)}")

@app.get("/api/data-validation-drafts/{draft_id}", response_model=DraftResponse)
def get_data_validation_draft(
    draft_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific draft by ID"""
    try:
        draft = db.query(models.DataValidationDraft).filter(
            models.DataValidationDraft.id == draft_id,
            models.DataValidationDraft.user_id == current_user.id
        ).first()
        
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        # Get user name for response
        user_name = f"{current_user.firstname} {current_user.lastname}".strip()
        
        # Get file name if file_id is provided
        file_name = None
        if draft.file_id:
            file_obj = db.query(models.UploadedFile).filter(models.UploadedFile.id == draft.file_id).first()
            if file_obj:
                file_name = file_obj.original_filename
        
        return DraftResponse(
            id=draft.id,
            user_id=draft.user_id,
            file_id=draft.file_id,
            draft_name=draft.draft_name,
            extracted_data=draft.extracted_data,
            working_json=draft.working_json,
            pending_changes=draft.pending_changes,
            last_saved=draft.last_saved,
            created_at=draft.created_at,
            user_name=user_name,
            file_name=file_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching draft: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch draft: {str(e)}")

@app.delete("/api/data-validation-drafts/{draft_id}")
def delete_data_validation_draft(
    draft_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a draft by ID"""
    try:
        draft = db.query(models.DataValidationDraft).filter(
            models.DataValidationDraft.id == draft_id,
            models.DataValidationDraft.user_id == current_user.id
        ).first()
        
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        db.delete(draft)
        db.commit()
        
        return {
            "status": "success",
            "message": f"Draft '{draft.draft_name}' deleted successfully",
            "draft_id": draft_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error deleting draft: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete draft: {str(e)}")

# =============================================================================
# 3-STEP DOCUMENT PROCESSING WORKFLOW ENDPOINTS
# =============================================================================

@app.post("/process-docx-to-xml")
async def process_docx_to_xml(file: UploadFile = File(...)):
    """
    Step 1: Convert DOCX to XML using cag_doc_xml.py
    """
    try:
        # Validate file type
        if not file.filename.lower().endswith('.docx'):
            raise HTTPException(status_code=400, detail="Only DOCX files are supported")
        
        # Save uploaded file temporarily
        temp_dir = tempfile.mkdtemp()
        temp_file_path = os.path.join(temp_dir, file.filename)
        
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Import and use cag_doc_xml functions
        try:
            from cag_doc_xml import docx_to_custom_xml
        except ImportError:
            raise HTTPException(status_code=500, detail="DOCX to XML conversion module not available")
        
        # Convert DOCX to XML
        xml_output_path = temp_file_path.replace('.docx', '.xml')
        docx_to_custom_xml(temp_file_path, xml_output_path)
        
        # Read the generated XML content
        with open(xml_output_path, 'r', encoding='utf-8') as f:
            xml_content = f.read()
        
        # Clean up temporary files
        os.remove(temp_file_path)
        os.remove(xml_output_path)
        os.rmdir(temp_dir)
        
        return {
            "success": True,
            "message": "DOCX converted to XML successfully",
            "xmlContent": xml_content
        }
        
    except Exception as e:
        # Clean up on error
        if 'temp_dir' in locals():
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                if os.path.exists(xml_output_path):
                    os.remove(xml_output_path)
                os.rmdir(temp_dir)
            except:
                pass
        
        print(f"Error in DOCX to XML conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"DOCX to XML conversion failed: {str(e)}")

@app.post("/process-xml-to-md")
async def process_xml_to_md(request: dict):
    """
    Step 2: Convert XML to Markdown using cag_xml_md.py
    """
    try:
        xml_content = request.get("xmlContent")
        if not xml_content:
            raise HTTPException(status_code=400, detail="XML content is required")
        
        # Import and use cag_xml_md functions
        try:
            from cag_xml_md import xml_to_md
        except ImportError:
            raise HTTPException(status_code=500, detail="XML to Markdown conversion module not available")
        
        # Save XML content to temporary file
        temp_dir = tempfile.mkdtemp()
        temp_xml_path = os.path.join(temp_dir, "temp.xml")
        temp_md_path = os.path.join(temp_dir, "temp.md")
        
        with open(temp_xml_path, 'w', encoding='utf-8') as f:
            f.write(xml_content)
        
        # Convert XML to Markdown
        xml_to_md(temp_xml_path, temp_md_path)
        
        # Read the generated Markdown content
        with open(temp_md_path, 'r', encoding='utf-8') as f:
            md_content = f.read()
        
        # Clean up temporary files
        os.remove(temp_xml_path)
        os.remove(temp_md_path)
        os.rmdir(temp_dir)
        
        return {
            "success": True,
            "message": "XML converted to Markdown successfully",
            "mdContent": md_content
        }
        
    except Exception as e:
        # Clean up on error
        if 'temp_dir' in locals():
            try:
                if os.path.exists(temp_xml_path):
                    os.remove(temp_xml_path)
                if os.path.exists(temp_md_path):
                    os.remove(temp_md_path)
                os.rmdir(temp_dir)
            except:
                pass
        
        print(f"Error in XML to Markdown conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"XML to Markdown conversion failed: {str(e)}")

@app.post("/process-md-to-json")
async def process_md_to_json(request: dict):
    """
    Step 3: Convert Markdown to JSON using cag_md_json 1.py
    """
    try:
        md_content = request.get("mdContent")
        if not md_content:
            raise HTTPException(status_code=400, detail="Markdown content is required")
        
        # Import and use cag_md_json functions
        try:
            # Note: The filename has a space, so we need to handle it carefully
            import importlib.util
            spec = importlib.util.spec_from_file_location("cag_md_json", "cag_md_json 1.py")
            cag_md_json_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cag_md_json_module)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Markdown to JSON conversion module not available: {str(e)}")
        
        # Save Markdown content to temporary file
        temp_dir = tempfile.mkdtemp()
        temp_md_path = os.path.join(temp_dir, "temp.md")
        temp_json_path = os.path.join(temp_dir, "temp.json")
        
        with open(temp_md_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        # Convert Markdown to JSON using the module's functions
        try:
            # Use the process_markdown_file function from cag_md_json 1.py
            json_data = cag_md_json_module.process_markdown_file(temp_md_path)
            json_content = json.dumps(json_data, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error in Markdown to JSON conversion: {str(e)}")
            # If conversion fails, create a basic structure with the markdown content
            json_content = json.dumps({
                "error": f"Markdown to JSON conversion failed: {str(e)}",
                "markdown_content": md_content,
                "metadata": {
                    "document_name": "conversion_failed",
                    "conversion_error": str(e)
                }
            }, indent=2)
        
        # Clean up temporary files
        os.remove(temp_md_path)
        if os.path.exists(temp_json_path):
            os.remove(temp_json_path)
        os.rmdir(temp_dir)
        
        return {
            "success": True,
            "message": "Markdown converted to JSON successfully",
            "jsonData": json.loads(json_content) if json_content else {}
        }
        
    except Exception as e:
        # Clean up on error
        if 'temp_dir' in locals():
            try:
                if os.path.exists(temp_md_path):
                    os.remove(temp_md_path)
                if os.path.exists(temp_json_path):
                    os.remove(temp_json_path)
                os.rmdir(temp_dir)
            except:
                pass
        
        print(f"Error in Markdown to JSON conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Markdown to JSON conversion failed: {str(e)}")

# =============================================================================
# DATA VALIDATION UPLOAD ENDPOINT WITH 3-STEP CONVERSION
# =============================================================================

@app.post("/data-validation-upload")
async def data_validation_upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload file for data validation with 3-step DOCX conversion workflow
    """
    try:
        # Validate file type
        if not (file.filename.lower().endswith('.docx') or file.filename.lower().endswith('.json')):
            raise HTTPException(status_code=400, detail="Only DOCX and JSON files are supported")
        
        # Save uploaded file
        upload_dir = "uploads"
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
        
        clean_filename = os.path.basename(file.filename)
        clean_filename = re.sub(r'[^\w\s.-]', '', clean_filename)
        clean_filename = re.sub(r'\s+', ' ', clean_filename).strip()
        
        unique_path = os.path.join(upload_dir, clean_filename)
        
        # Save file to disk
        with open(unique_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Create database record
        db_file = models.UploadedFile(
            filename=clean_filename,
            original_filename=clean_filename,
            file_path=unique_path,
            file_size=os.path.getsize(unique_path),
            file_type=file.content_type or "application/octet-stream",
            uploaded_at=datetime.now()
        )
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        
        result = {
            "success": True,
            "message": "File uploaded successfully",
            "file_id": db_file.id,
            "filename": clean_filename,
            "file_path": unique_path
        }
        
        # If it's a DOCX file, perform 3-step conversion
        if file.filename.lower().endswith('.docx'):
            try:
                print(f"Starting 3-step conversion for DOCX file: {clean_filename}")
                
                # Step 1: DOCX to XML
                print("Step 1: Converting DOCX to XML...")
                from cag_doc_xml import docx_to_custom_xml
                xml_output_path = unique_path.replace('.docx', '.xml')
                docx_to_custom_xml(unique_path, xml_output_path)
                
                # Step 2: XML to Markdown
                print("Step 2: Converting XML to Markdown...")
                from cag_xml_md import xml_to_md
                md_output_path = unique_path.replace('.docx', '.md')
                xml_to_md(xml_output_path, md_output_path)
                
                # Step 3: Markdown to JSON
                print("Step 3: Converting Markdown to JSON...")
                import importlib.util
                spec = importlib.util.spec_from_file_location("cag_md_json", "cag_md_json 1.py")
                cag_md_json_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(cag_md_json_module)
                
                json_data = cag_md_json_module.process_markdown_file(md_output_path)
                
                # Save JSON to file
                json_output_path = unique_path.replace('.docx', '.json')
                with open(json_output_path, 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, indent=2, ensure_ascii=False)
                
                # Update database record with JSON data
                db_file.extracted_json = json_data
                db_file.json_updated_at = datetime.now()
                db_file.updated_json = json_data
                db.commit()
                
                # Save XML and MD files for future download
                xml_filename = f"{os.path.splitext(clean_filename)[0]}.xml"
                md_filename = f"{os.path.splitext(clean_filename)[0]}.md"
                xml_save_path = os.path.join(upload_dir, xml_filename)
                md_save_path = os.path.join(upload_dir, md_filename)
                
                # Copy XML and MD files to permanent location
                shutil.copy2(xml_output_path, xml_save_path)
                shutil.copy2(md_output_path, md_save_path)
                
                # Update database with XML and MD file info (if columns exist)
                try:
                    db_file.xml_filename = xml_filename
                    db_file.xml_file_path = xml_save_path
                    db_file.xml_file_size = os.path.getsize(xml_save_path)
                    db_file.xml_uploaded_at = datetime.now()
                    
                    db_file.md_filename = md_filename
                    db_file.md_file_path = md_save_path
                    db_file.md_file_size = os.path.getsize(md_save_path)
                    db_file.md_uploaded_at = datetime.now()
                except AttributeError:
                    # Database doesn't have XML/MD columns yet, skip silently
                    print("XML/MD columns not available in database yet")
                
                # Clean up intermediate files
                os.remove(xml_output_path)
                os.remove(md_output_path)
                
                result.update({
                    "conversion_completed": True,
                    "message": "DOCX file uploaded and converted to JSON successfully",
                    "json_data": json_data,
                    "has_json": True
                })
                
                print(f"3-step conversion completed successfully for: {clean_filename}")
                
            except Exception as e:
                print(f"Error in 3-step conversion: {str(e)}")
                result.update({
                    "conversion_completed": False,
                    "conversion_error": str(e),
                    "message": "File uploaded but conversion failed"
                })
        
        return result
        
    except Exception as e:
        print(f"Error in data validation upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# =============================================================================
# END OF 3-STEP WORKFLOW ENDPOINTS
# =============================================================================

# =============================================================================
# METADATA EXTRACTION FUNCTION
# =============================================================================
