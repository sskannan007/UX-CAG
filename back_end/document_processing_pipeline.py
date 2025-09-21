#!/usr/bin/env python3
"""
Document Processing Pipeline
============================

This script processes Word documents (.docx) directly to JSON and stores in database.
Simplified flow: DOCX → JSON → Database

Usage:
    python document_processing_pipeline.py [docx_file_path] [db_session] [file_id]
    
If no arguments provided, it will use default folders for batch processing.
"""

import os
import sys
import json
import logging
from pathlib import Path
import tempfile
import shutil
from datetime import datetime, timezone

# Import the three processing modules
try:
    import cag_doc_xml
    import cag_xml_md
    # Import cag_md_json with the correct filename (has space and number)
    import importlib.util
    spec = importlib.util.spec_from_file_location("cag_md_json", "cag_md_json.py")
    cag_md_json = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cag_md_json)
except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Make sure cag_doc_xml.py, cag_xml_md.py, and cag_md_json.py are in the same directory.")
    sys.exit(1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def process_docx_to_json_and_db(docx_path, db_session, file_id):
    """
    Process a single DOCX file to JSON and store in database.
    
    Args:
        docx_path (str): Path to the DOCX file
        db_session: Database session
        file_id (int): ID of the file record in database
    
    Returns:
        dict: Result with status and extracted JSON data
    """
    docx_path = Path(docx_path)
    base_name = docx_path.stem
    
    logger.info(f"Processing: {docx_path.name}")
    
    try:
        # Create temporary folders for intermediate files
        temp_xml_folder = Path(tempfile.mkdtemp(prefix='pipeline_xml_'))
        temp_md_folder = Path(tempfile.mkdtemp(prefix='pipeline_md_'))
        
        try:
            # Step 1: DOCX to XML
            logger.info(f"Step 1: Converting {docx_path.name} to XML")
            xml_path = temp_xml_folder / f"{base_name}.xml"
            cag_doc_xml.docx_to_custom_xml(str(docx_path), str(xml_path))
            
            if not xml_path.exists():
                raise Exception("Failed to create XML file")
            
            logger.info(f"✓ XML created: {xml_path.name}")
            
            # Step 2: XML to Markdown
            logger.info(f"Step 2: Converting {xml_path.name} to Markdown")
            md_path = temp_md_folder / f"{base_name}.md"
            cag_xml_md.xml_to_md(str(xml_path), str(md_path))
            
            if not md_path.exists():
                raise Exception("Failed to create Markdown file")
            
            logger.info(f"✓ Markdown created: {md_path.name}")
            
            # Step 3: Markdown to JSON
            logger.info(f"Step 3: Converting {md_path.name} to JSON")
            
            # Process the markdown file using the existing function
            structured_data = cag_md_json.process_markdown_file(str(md_path))
            
            # Convert to JSON string with proper escaping
            try:
                json_string = json.dumps(structured_data, indent=2, ensure_ascii=False)
            except Exception as e:
                logger.error(f"JSON serialization error: {e}")
                # Try to fix the structured data before JSON conversion
                structured_data = _fix_structured_data_for_json(structured_data)
                json_string = json.dumps(structured_data, indent=2, ensure_ascii=False)
            
            # Save JSON file to uploads folder
            json_filename = f"{base_name}.json"
            json_file_path = os.path.join(os.path.dirname(docx_path), json_filename)
            
            try:
                with open(json_file_path, 'w', encoding='utf-8') as json_file:
                    json_file.write(json_string)
                logger.info(f"✓ JSON file saved: {json_file_path}")
            except Exception as e:
                logger.error(f"Failed to save JSON file: {e}")
            
            # Update database record with extracted JSON
            from models import UploadedFile
            file_record = db_session.query(UploadedFile).filter(UploadedFile.id == file_id).first()
            
            if file_record:
                file_record.extracted_json = structured_data
                file_record.json_updated_at = datetime.now(timezone.utc)
                db_session.commit()
                logger.info(f"✓ JSON stored in database for file ID: {file_id}")
            else:
                logger.error(f"File record not found for ID: {file_id}")
                return {
                    'status': 'error',
                    'message': f'File record not found for ID: {file_id}',
                    'extracted_json': None
                }
            
            logger.info(f"✅ Successfully processed: {docx_path.name}")
            
            return {
                'status': 'success',
                'message': f'Successfully processed {docx_path.name}',
                'extracted_json': structured_data
            }
            
        finally:
            # Clean up temporary folders
            if temp_xml_folder and temp_xml_folder.exists():
                shutil.rmtree(temp_xml_folder)
                logger.info(f"Cleaned up temp XML folder: {temp_xml_folder}")
            
            if temp_md_folder and temp_md_folder.exists():
                shutil.rmtree(temp_md_folder)
                logger.info(f"Cleaned up temp MD folder: {temp_md_folder}")
            
    except Exception as e:
        error_msg = f"❌ Error processing {docx_path.name}: {str(e)}"
        logger.error(error_msg)
        return {
            'status': 'error',
            'message': error_msg,
            'extracted_json': None
        }

def _fix_structured_data_for_json(data):
    """Fix structured data to ensure it's JSON serializable"""
    if isinstance(data, dict):
        fixed_dict = {}
        for key, value in data.items():
            fixed_dict[key] = _fix_structured_data_for_json(value)
        return fixed_dict
    elif isinstance(data, list):
        return [_fix_structured_data_for_json(item) for item in data]
    elif isinstance(data, str):
        # Fix any problematic characters in strings
        return data.replace('\x00', '').replace('\x01', '').replace('\x02', '')
    else:
        return data

class DocumentProcessor:
    """Main class for processing documents through the pipeline"""
    
    def __init__(self, input_folder, output_folder):
        self.input_folder = Path(input_folder)
        self.output_folder = Path(output_folder)
        self.temp_xml_folder = None
        self.temp_md_folder = None
        
        # Create output folder if it doesn't exist
        self.output_folder.mkdir(parents=True, exist_ok=True)
        
        # Statistics
        self.stats = {
            'total_files': 0,
            'successful': 0,
            'failed': 0,
            'errors': []
        }
    
    def setup_temp_folders(self):
        """Create temporary folders for intermediate files"""
        self.temp_xml_folder = Path(tempfile.mkdtemp(prefix='pipeline_xml_'))
        self.temp_md_folder = Path(tempfile.mkdtemp(prefix='pipeline_md_'))
        logger.info(f"Created temp XML folder: {self.temp_xml_folder}")
        logger.info(f"Created temp MD folder: {self.temp_md_folder}")
    
    def cleanup_temp_folders(self):
        """Clean up temporary folders"""
        if self.temp_xml_folder and self.temp_xml_folder.exists():
            shutil.rmtree(self.temp_xml_folder)
            logger.info(f"Cleaned up temp XML folder: {self.temp_xml_folder}")
        
        if self.temp_md_folder and self.temp_md_folder.exists():
            shutil.rmtree(self.temp_md_folder)
            logger.info(f"Cleaned up temp MD folder: {self.temp_md_folder}")
    
    def process_single_document(self, docx_path):
        """Process a single DOCX document through the entire pipeline"""
        docx_path = Path(docx_path)
        base_name = docx_path.stem
        
        logger.info(f"Processing: {docx_path.name}")
        
        try:
            # Step 1: DOCX to XML
            logger.info(f"Step 1: Converting {docx_path.name} to XML")
            xml_path = self.temp_xml_folder / f"{base_name}.xml"
            cag_doc_xml.docx_to_custom_xml(str(docx_path), str(xml_path))
            
            if not xml_path.exists():
                raise Exception("Failed to create XML file")
            
            logger.info(f"✓ XML created: {xml_path.name}")
            
            # Step 2: XML to Markdown
            logger.info(f"Step 2: Converting {xml_path.name} to Markdown")
            md_path = self.temp_md_folder / f"{base_name}.md"
            cag_xml_md.xml_to_md(str(xml_path), str(md_path))
            
            if not md_path.exists():
                raise Exception("Failed to create Markdown file")
            
            logger.info(f"✓ Markdown created: {md_path.name}")
            
            # Step 3: Markdown to JSON
            logger.info(f"Step 3: Converting {md_path.name} to JSON")
            json_path = self.output_folder / f"{base_name}.json"
            
            # Process the markdown file using the existing function
            structured_data = cag_md_json.process_markdown_file(str(md_path))
            
            # Convert to JSON string with proper escaping
            try:
                json_string = json.dumps(structured_data, indent=2, ensure_ascii=False)
            except Exception as e:
                logger.error(f"JSON serialization error: {e}")
                # Try to fix the structured data before JSON conversion
                structured_data = self._fix_structured_data_for_json(structured_data)
                json_string = json.dumps(structured_data, indent=2, ensure_ascii=False)
            
            # Write JSON file
            with open(json_path, 'w', encoding='utf-8') as f:
                f.write(json_string)
            
            logger.info(f"✓ JSON created: {json_path.name}")
            logger.info(f"✅ Successfully processed: {docx_path.name}")
            
            self.stats['successful'] += 1
            return True
            
        except Exception as e:
            error_msg = f"❌ Error processing {docx_path.name}: {str(e)}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)
            self.stats['failed'] += 1
            return False
    
    def _fix_structured_data_for_json(self, data):
        """Fix structured data to ensure it's JSON serializable"""
        if isinstance(data, dict):
            fixed_dict = {}
            for key, value in data.items():
                fixed_dict[key] = self._fix_structured_data_for_json(value)
            return fixed_dict
        elif isinstance(data, list):
            return [self._fix_structured_data_for_json(item) for item in data]
        elif isinstance(data, str):
            # Fix any problematic characters in strings
            return data.replace('\x00', '').replace('\x01', '').replace('\x02', '')
        else:
            return data
    
    def process_all_documents(self):
        """Process all DOCX documents in the input folder"""
        logger.info(f"Starting document processing pipeline")
        logger.info(f"Input folder: {self.input_folder}")
        logger.info(f"Output folder: {self.output_folder}")
        
        # Setup temporary folders
        self.setup_temp_folders()
        
        try:
            # Find all DOCX files
            docx_files = list(self.input_folder.glob("*.docx"))
            
            if not docx_files:
                logger.warning(f"No .docx files found in {self.input_folder}")
                return
            
            self.stats['total_files'] = len(docx_files)
            logger.info(f"Found {len(docx_files)} DOCX files to process")
            
            # Process each file
            for docx_file in docx_files:
                self.process_single_document(docx_file)
            
            # Print summary
            self.print_summary()
            
        finally:
            # Always cleanup temp folders
            self.cleanup_temp_folders()
    
    def print_summary(self):
        """Print processing summary"""
        print("\n" + "="*60)
        print("PROCESSING SUMMARY")
        print("="*60)
        print(f"Total files: {self.stats['total_files']}")
        print(f"Successful: {self.stats['successful']}")
        print(f"Failed: {self.stats['failed']}")
        
        if self.stats['errors']:
            print(f"\nErrors encountered:")
            for error in self.stats['errors']:
                print(f"  - {error}")
        
        
        print(f"\nOutput folder: {self.output_folder}")
        print("="*60)

def main():
    """Main function to run the pipeline"""
    
    # Check if called with direct processing arguments (docx_path, db_session, file_id)
    if len(sys.argv) == 4:
        docx_path = sys.argv[1]
        # For direct processing, we expect the caller to handle database session
        # This is mainly for backward compatibility with batch processing
        print(f"Direct processing mode not supported via command line")
        print(f"Use process_docx_to_json_and_db() function instead")
        sys.exit(1)
    
    # Default folders - Updated for local development
    default_input = "uploads"  # Local uploads folder
    default_output = "converted_json"  # Local output folder
    
    # Parse command line arguments
    if len(sys.argv) == 3:
        input_folder = sys.argv[1]
        output_folder = sys.argv[2]
    elif len(sys.argv) == 2:
        input_folder = sys.argv[1]
        output_folder = default_output
    else:
        input_folder = default_input
        output_folder = default_output
    
    # Validate input folder exists
    if not os.path.exists(input_folder):
        print(f"Error: Input folder '{input_folder}' does not exist!")
        sys.exit(1)
    
    print(f"Document Processing Pipeline")
    print(f"Input folder: {input_folder}")
    print(f"Output folder: {output_folder}")
    print("-" * 60)
    
    # Create and run processor
    processor = DocumentProcessor(input_folder, output_folder)
    processor.process_all_documents()

if __name__ == "__main__":
    main()
