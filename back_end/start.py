#!/usr/bin/env python3
"""
Startup script for the FastAPI backend
"""
import uvicorn
from main import app

if __name__ == "__main__":
    print("Starting FastAPI server...")
    print("API Documentation available at: http://127.0.0.1:8000/docs")
    print("API Base URL: http://127.0.0.1:8000")
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )

