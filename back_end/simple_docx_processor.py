#!/usr/bin/env python3
"""
Simplified DOCX to JSON processor for testing
This is a fallback when the full pipeline modules are not available
"""

import os
import json
import logging
from datetime import datetime, timezone
from docx import Document

logger = logging.getLogger(__name__)

def simple_docx_to_json(docx_path, db_session, file_id):
    """
    Simple DOCX to JSON conversion for testing
    This extracts basic text content from DOCX files
    """
    try:
        logger.info(f"Processing DOCX file: {docx_path}")
        
        # Load the DOCX document
        doc = Document(docx_path)
        
        # Extract basic content
        content = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                content.append(paragraph.text.strip())
        
        # Extract metadata from content
        document_name = os.path.basename(docx_path)
        department = "Unknown"
        year = datetime.now().year
        state = "Tamilnadu"
        
        # Try to extract metadata from content
        if content:
            # Look for document title in first few lines
            for i, line in enumerate(content[:5]):
                if len(line) > 10 and any(keyword in line.lower() for keyword in ['report', 'inspection', 'audit', 'account', 'registry']):
                    document_name = line.strip()
                    break
            
            # Look for department information
            for line in content[:10]:
                line_lower = line.lower()
                if 'sub registry' in line_lower or 'registry' in line_lower:
                    department = "Sub Registry"
                elif 'commercial' in line_lower:
                    department = "Commercial"
                elif 'revenue' in line_lower:
                    department = "Revenue"
                elif 'audit' in line_lower:
                    department = "Audit"
            
            # Look for year information
            import re
            for line in content[:10]:
                year_match = re.search(r'(20\d{2})', line)
                if year_match:
                    year = int(year_match.group(1))
                    break
            
            # Look for state information
            for line in content[:10]:
                line_lower = line.lower()
                if 'tamilnadu' in line_lower or 'tamil nadu' in line_lower:
                    state = "Tamilnadu"
                elif 'kerala' in line_lower:
                    state = "Kerala"
                elif 'karnataka' in line_lower:
                    state = "Karnataka"
        
        # Create a structured JSON with metadata
        extracted_data = {
            "filename": os.path.basename(docx_path),
            "document_name": document_name,
            "department": department,
            "year": year,
            "state": state,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "content": content,
            "paragraph_count": len(content),
            "status": "processed_simple"
        }
        
        # Save JSON file to uploads folder
        base_name = os.path.splitext(os.path.basename(docx_path))[0]
        json_filename = f"{base_name}.json"
        json_file_path = os.path.join(os.path.dirname(docx_path), json_filename)
        
        try:
            json_string = json.dumps(extracted_data, indent=2, ensure_ascii=False)
            with open(json_file_path, 'w', encoding='utf-8') as json_file:
                json_file.write(json_string)
            logger.info(f"✓ JSON file saved: {json_file_path}")
        except Exception as e:
            logger.error(f"Failed to save JSON file: {e}")
        
        # Update database record
        from models import UploadedFile
        file_record = db_session.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        
        if file_record:
            file_record.extracted_json = extracted_data
            file_record.json_updated_at = datetime.now(timezone.utc)
            file_record.status = "processed"
            db_session.commit()
            logger.info(f"✅ Simple processing completed for file ID: {file_id}")
            
            return {
                'status': 'success',
                'message': f'Successfully processed {os.path.basename(docx_path)} with simple processor',
                'extracted_json': extracted_data
            }
        else:
            logger.error(f"File record not found for ID: {file_id}")
            return {
                'status': 'error',
                'message': f'File record not found for ID: {file_id}',
                'extracted_json': None
            }
            
    except Exception as e:
        error_msg = f"❌ Error in simple processing: {str(e)}"
        logger.error(error_msg)
        return {
            'status': 'error',
            'message': error_msg,
            'extracted_json': None
        }
