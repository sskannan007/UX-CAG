#!/usr/bin/env python3
"""
Backend server runner for PROOF BOX
Run this file to start the Flask backend server
"""

import os
import sys
from app import app, create_tables

def main():
    """Start the backend server"""
    print("Starting PROOF BOX Backend Server...")
    print("=" * 50)
    
    # Create database tables
    print("Creating database tables...")
    create_tables()
    print("Database tables created!")
    
    # Set environment variables
    os.environ.setdefault('DATABASE_URL', 'sqlite:///./cag_database.db')
    os.environ.setdefault('SECRET_KEY', 'your-secret-key-here')
    
    print("Backend server starting on http://localhost:5000")
    print("API endpoints available:")
    print("  - POST /api/bulk-process-documents")
    print("  - GET  /api/uploaded-files")
    print("  - GET  /api/uploaded-files/<id>/content")
    print("  - POST /api/uploaded-files/batch-content")
    print("  - GET  /admin/users/list")
    print("  - POST /admin/assign-files")
    print("  - GET  /users/me")
    print("=" * 50)
    
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5000)

if __name__ == '__main__':
    main()
