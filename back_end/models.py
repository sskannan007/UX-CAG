from sqlalchemy import Column, Integer, String, Date, DateTime, func, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firstname = Column(String(100), nullable=False)
    lastname = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    dob = Column(Date)
    contactno = Column(String(20))
    place = Column(String(100))
    city = Column(String(100))
    state = Column(String(100))
    pincode = Column(String(10))
    gender = Column(String(10))
    password = Column(String(255), nullable=False)
    role_status = Column(String(50), default="unassigned")
    account_created_at = Column(DateTime, server_default=func.now(timezone='utc'))
    
    # Relationships
    user_roles = relationship("UserRole", back_populates="user")
    config = relationship("UserConfig", back_populates="user", uselist=False)

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now(timezone='utc'))
    
    # Relationships
    user_roles = relationship("UserRole", back_populates="role")
    role_menus = relationship("RoleMenu", back_populates="role")

class UserRole(Base):
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"))
    assigned_at = Column(DateTime, server_default=func.now(timezone='utc'))
    
    # Relationships
    user = relationship("User", back_populates="user_roles")
    role = relationship("Role", back_populates="user_roles")

class Menu(Base):
    __tablename__ = "menus"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    display_name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("menus.id"))
    route = Column(String(100))
    icon = Column(String(100))
    order_index = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now(timezone='utc'))
    
    # Relationships
    parent = relationship("Menu", remote_side=[id])
    children = relationship("Menu", overlaps="parent")
    role_menus = relationship("RoleMenu", back_populates="menu")

class RoleMenu(Base):
    __tablename__ = "role_menus"
    
    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"))
    menu_id = Column(Integer, ForeignKey("menus.id", ondelete="CASCADE"))
    can_view = Column(Boolean, default=False)
    can_create = Column(Boolean, default=False)
    can_update = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    assigned_at = Column(DateTime, server_default=func.now(timezone='utc'))
    
    # Relationships
    role = relationship("Role", back_populates="role_menus")
    menu = relationship("Menu", back_populates="role_menus")

class UserConfig(Base):
    __tablename__ = "user_config"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    config = Column(JSON, default={
        "home": False,
        "about": False,
        "feedback": False,
        "data_validation": False,
        "bulkUpload": False,
        "admin": False,
        "users": False,
        "user_management": False,
        "audit_logs": False,
        "assigned_documents": False
    })
    created_at = Column(DateTime, server_default=func.now(timezone='utc'))
    updated_at = Column(DateTime, server_default=func.now(timezone='utc'), onupdate=func.now(timezone='utc'))
    
    # Relationship with User
    user = relationship("User", back_populates="config")

class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(100))
    uploaded_at = Column(DateTime, server_default=func.now(timezone='utc'))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    status = Column(String(50), default="active")
    
    # Simplified JSON storage - JSON data stored directly in database
    extracted_json = Column(JSON, nullable=True)
    json_updated_at = Column(DateTime, nullable=True)
    
    # Updated JSON for validation workflow
    updated_json = Column(JSON, nullable=True)
    
    # Relationship with User (optional)
    user = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    old_json = Column(JSON, nullable=True)
    new_json = Column(JSON, nullable=True)
    # Store list of modified paths as JSON array of strings for easy retrieval
    modified = Column(JSON, nullable=True)
    username = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ip = Column(String(64), nullable=True)
    action = Column(String(100), nullable=False)
    timestamp = Column(DateTime, server_default=func.now(timezone='utc'))
    file_id = Column(Integer, ForeignKey("uploaded_files.id"), nullable=True)

    # Optional relationships
    user = relationship("User", foreign_keys=[user_id])

class UserFileAssignment(Base):
    __tablename__ = "user_file_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(Integer, ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime, server_default=func.now(timezone='utc'))
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    validated = Column(Integer, default=0)

    # Optional relationships (no backrefs to keep it simple)

class DataValidationFeedback(Base):
    __tablename__ = "data_validation_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(Integer, ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=True)
    severity = Column(String(20), nullable=False)  # 'high', 'moderate', 'low'
    issue_description = Column(Text, nullable=False)
    field_path = Column(String(500), nullable=True)  # JSON path to the field with issue
    field_value = Column(Text, nullable=True)  # Current value of the field
    status = Column(String(20), default="pending")  # 'pending', 'reviewed', 'resolved'
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(timezone='utc'))
    updated_at = Column(DateTime, server_default=func.now(timezone='utc'), onupdate=func.now(timezone='utc'))

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    file = relationship("UploadedFile", foreign_keys=[file_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])

class DataValidationDraft(Base):
    __tablename__ = "data_validation_drafts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(Integer, ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=True)
    draft_name = Column(String(255), nullable=False)
    extracted_data = Column(JSON, nullable=True)  # Store the extracted data state
    working_json = Column(JSON, nullable=True)    # Store the working JSON
    pending_changes = Column(JSON, nullable=True) # Store pending changes as JSON
    last_saved = Column(DateTime, server_default=func.now(timezone='utc'), onupdate=func.now(timezone='utc'))
    created_at = Column(DateTime, server_default=func.now(timezone='utc'))
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    file = relationship("UploadedFile", foreign_keys=[file_id])

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(Integer, ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=True)
    activity_type = Column(String(50), nullable=False)  # 'validation', 'modification', 'feedback', 'draft_save', 'draft_load'
    file_name = Column(String(255), nullable=True)
    period = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    state = Column(String(255), nullable=True)
    modification_count = Column(Integer, default=0)
    feedback_count = Column(Integer, default=0)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(timezone='utc'))
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    file = relationship("UploadedFile", foreign_keys=[file_id])

class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    otp_code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now(timezone='utc'))
