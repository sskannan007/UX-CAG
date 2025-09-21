#!/usr/bin/env python3
"""
Test script to verify the document processing pipeline
"""

import requests
import os
from pathlib import Path

def test_upload():
    """Test the bulk upload endpoint"""
    url = "http://localhost:8000/api/bulk-process-documents"
    
    # Check if there's a test file in uploads folder
    uploads_dir = Path("uploads")
    test_files = list(uploads_dir.glob("*.docx"))
    
    if not test_files:
        print("❌ No DOCX files found in uploads folder")
        print("Please add a test DOCX file to the uploads folder")
        return
    
    test_file = test_files[0]
    print(f"Testing with file: {test_file.name}")
    
    try:
        with open(test_file, 'rb') as f:
            files = {'files': (test_file.name, f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
            
            response = requests.post(url, files=files)
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Upload successful!")
                print(f"Status: {data['status']}")
                print(f"Total files: {data['total_files']}")
                print(f"Word documents: {data['word_documents']}")
                print(f"Processed: {data['processed']}")
                
                if data['results']:
                    print("\nResults:")
                    for result in data['results']:
                        print(f"  - {result['filename']}: {result['status']}")
                
                if data['errors']:
                    print("\nErrors:")
                    for error in data['errors']:
                        print(f"  - {error['filename']}: {error['error']}")
            else:
                print(f"❌ Upload failed: {response.status_code}")
                print(response.text)
                
    except Exception as e:
        print(f"❌ Error: {e}")

def test_get_files():
    """Test the get uploaded files endpoint"""
    url = "http://localhost:8000/api/uploaded-files"
    
    try:
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Get files successful!")
            print(f"Total files: {data['total']}")
            print(f"Files returned: {len(data['files'])}")
            
            if data['files']:
                print("\nFiles:")
                for file in data['files']:
                    print(f"  - {file['filename']}: {file['status']}")
        else:
            print(f"❌ Get files failed: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("Testing document processing pipeline...")
    print("=" * 50)
    
    print("\n1. Testing upload endpoint...")
    test_upload()
    
    print("\n2. Testing get files endpoint...")
    test_get_files()
    
    print("\n" + "=" * 50)
    print("Test completed!")

