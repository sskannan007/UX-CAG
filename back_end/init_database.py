from database import engine, SessionLocal
from models import Base, User, UserConfig, Role, Menu, RoleMenu, UserRole
from sqlalchemy.orm import Session
import os

def create_tables():
    """Create all database tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

def create_default_data():
    """Create default users, roles, and configurations"""
    db = SessionLocal()
    
    try:
        # Create default admin user
        admin_user = db.query(User).filter(User.email == "admin@example.com").first()
        if not admin_user:
            admin_user = User(
                firstname="Admin",
                lastname="User",
                email="admin@example.com",
                password="admin123",  # In production, hash this password
                role_status="assigned"
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print("Created admin user")
        
        # Create default user config for admin
        admin_config = db.query(UserConfig).filter(UserConfig.user_id == admin_user.id).first()
        if not admin_config:
            admin_config = UserConfig(
                user_id=admin_user.id,
                config={
                    "home": True,
                    "about": True,
                    "feedback": True,
                    "data_validation": True,
                    "bulkUpload": True,
                    "admin": True,
                    "users": True,
                    "user_management": True,
                    "audit_logs": True,
                    "assigned_documents": True
                }
            )
            db.add(admin_config)
            print("Created admin user config")
        
        # Create demo user
        demo_user = db.query(User).filter(User.email == "demo@example.com").first()
        if not demo_user:
            demo_user = User(
                firstname="Demo",
                lastname="User",
                email="demo@example.com",
                password="demo123",  # In production, hash this password
                role_status="assigned"
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            print("Created demo user")
        
        # Create demo user config
        demo_config = db.query(UserConfig).filter(UserConfig.user_id == demo_user.id).first()
        if not demo_config:
            demo_config = UserConfig(
                user_id=demo_user.id,
                config={
                    "home": True,
                    "data_validation": True,
                    "bulkUpload": True,
                    "assigned_documents": True,
                    "admin": False,
                    "users": False,
                    "user_management": False,
                    "audit_logs": False
                }
            )
            db.add(demo_config)
            print("Created demo user config")
        
        # Create default roles
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            admin_role = Role(
                name="admin",
                description="Administrator role with full access"
            )
            db.add(admin_role)
            print("Created admin role")
        
        user_role = db.query(Role).filter(Role.name == "user").first()
        if not user_role:
            user_role = Role(
                name="user",
                description="Regular user role"
            )
            db.add(user_role)
            print("Created user role")
        
        db.commit()
        print("Default data created successfully!")
        
    except Exception as e:
        print(f"Error creating default data: {e}")
        db.rollback()
    finally:
        db.close()

def main():
    """Initialize database with tables and default data"""
    print("Initializing database...")
    
    # Create tables
    create_tables()
    
    # Create default data
    create_default_data()
    
    print("Database initialization completed!")

if __name__ == "__main__":
    main()
