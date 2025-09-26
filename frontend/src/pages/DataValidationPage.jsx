import React, { useState, useRef, useEffect, useMemo, useCallback, memo, createContext, useContext } from 'react';
import { Modal, Button, Spinner, Container, Card } from 'react-bootstrap';
import TopNavbar from '../components/TopNavbar';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import extractedData from './extractedData';
// Removed sampleExtractedData import - using real data from database
import config from '../config.js';

const BASE_URL = config.BASE_URL;

// Create context for shared state
const ValidationContext = createContext();

// Memoized row component to prevent unnecessary re-renders
const ExtractedItemRow = memo(({ 
  node, 
  index, 
  fieldKey, 
  uniqueKey
}) => {
  const {
    rowFeedback,
    selectedField,
    showValidationForRow,
    validationType,
    comments,
    editingField,
    editValue,
    handleFeedback,
    handleValidationType,
    handleCommentsSubmit,
    handleCloseValidation,
    handleEditField,
    handleSaveEdit,
    handleCancelEdit,
    setEditValue,
    setComments
  } = useContext(ValidationContext);

  const feedback = rowFeedback[fieldKey];
  return (
    <div className={`extracted-item ${selectedField === fieldKey ? 'selected' : ''}`} id={`row-${fieldKey}`}>
      <div className="extracted-item-header">
        <h6 className="extracted-item-title">{node.label}</h6>
        <div className="extracted-item-actions">
          <button 
            className={`btn btn-sm me-1 ${feedback?.type === 'positive' ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => handleFeedback(fieldKey, 'positive', index, node)}
            title="Thumbs up"
          >
            <i className="fas fa-thumbs-up"></i>
          </button>
          <button 
            className={`btn btn-sm me-1 ${feedback?.type === 'negative' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFeedback(fieldKey, 'negative', index, node);
            }}
            title="Thumbs down"
          >
            <i className="fas fa-thumbs-down"></i>
          </button>
          <button 
            className="btn btn-sm btn-outline-secondary"
            title="More options"
          >
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
      
      <div className="extracted-item-content">
        {node.content.map((item, itemIndex) => (
          <div key={itemIndex} className="extracted-item-value">
            <div className="value-label">{node.label}:</div>
            <div className="value-content">
              {editingField === fieldKey ? (
                <div className="edit-field-container">
                  <textarea
                    className="edit-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={3}
                  />
                  <div className="edit-actions">
                    <button 
                      className="btn btn-sm btn-success me-2"
                      onClick={handleSaveEdit}
                    >
                      <i className="fas fa-check me-1"></i>
                      Save
                    </button>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={handleCancelEdit}
                    >
                      <i className="fas fa-times me-1"></i>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="value-display">
                  {item.isTable ? (
                    <div 
                      className="table-container"
                      dangerouslySetInnerHTML={{ __html: item.tableHtml }}
                    />
                  ) : (
                    item.text
                  )}
                  {feedback && feedback.type === 'negative' && (
                    <button 
                      className="btn btn-sm btn-outline-primary edit-btn"
                      onClick={() => handleEditField(fieldKey, item.text)}
                      title="Edit this field"
                    >
                      <i className="fas fa-edit me-1"></i>
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Inline Validation Options */}
        {showValidationForRow === fieldKey && (
          <div className="inline-validation-box">
            <div className="validation-buttons">
              <button 
                className={`validation-btn ${validationType === 'missing' ? 'selected' : ''}`}
                onClick={() => handleValidationType('missing')}
              >
                Missing
              </button>
              <button 
                className={`validation-btn ${validationType === 'incorrect' ? 'selected' : ''}`}
                onClick={() => handleValidationType('incorrect')}
              >
                Incorrect
              </button>
              <button 
                className={`validation-btn ${validationType === 'extra' ? 'selected' : ''}`}
                onClick={() => handleValidationType('extra')}
              >
                Extra
              </button>
              <button 
                className={`validation-btn ${validationType === 'misclassified' ? 'selected' : ''}`}
                onClick={() => handleValidationType('misclassified')}
              >
                Misclassified
              </button>
            </div>
            
            <div className="comments-section">
              <label className="comments-label">Comments</label>
              <textarea
                className="comments-textarea"
                placeholder="Enter your comments here..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="validation-actions">
              <button 
                className="validation-action-btn validation-cancel"
                onClick={handleCloseValidation}
              >
                Cancel
              </button>
              <button 
                className="validation-action-btn validation-submit"
                onClick={handleCommentsSubmit}
                disabled={!validationType || !comments.trim()}
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {/* Feedback Status Display */}
        {feedback && (
          <div className={`feedback-status ${feedback.type === 'positive' ? 'positive-feedback' : 'negative-feedback'}`}>
            <div className="feedback-header">
              <i className={`fas ${feedback.type === 'positive' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
              <span className="feedback-type">
                {feedback.type === 'positive' ? 'Approved' : 'Needs Review'}
              </span>
              <span className="feedback-timestamp">
                {new Date(feedback.timestamp).toLocaleString()}
              </span>
            </div>
            {feedback.type === 'negative' && (
              <div className="feedback-details">
                <div className="feedback-validation-type">
                  <strong>Issue:</strong> {feedback.validationType}
                </div>
                <div className="feedback-comments">
                  <strong>Comments:</strong> {feedback.comments}
                </div>
                {feedback.replacedWithComments && (
                  <div className="feedback-replacement-info">
                    <strong>Value Replaced:</strong> Original value was replaced with comments above
                    {feedback.originalValue && (
                      <div className="replacement-comparison">
                        <div><strong>Original:</strong> {feedback.originalValue}</div>
                        <div><strong>Replaced With:</strong> {feedback.comments}</div>
                      </div>
                    )}
                  </div>
                )}
                {feedback.edited && (
                  <div className="feedback-edit-info">
                    <strong>Edited:</strong> {feedback.editTimestamp && new Date(feedback.editTimestamp).toLocaleString()}
                    {feedback.originalValue && feedback.newValue && (
                      <div className="edit-comparison">
                        <div><strong>Original:</strong> {feedback.originalValue}</div>
                        <div><strong>Updated:</strong> {feedback.newValue}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

ExtractedItemRow.displayName = 'ExtractedItemRow';

// Parse complex objects into separate rows - moved outside component to avoid hoisting issues
const parseComplexObject = (obj, baseKey, index = 0) => {
  const rows = [];
  
  console.log(`Parsing complex object for ${baseKey}:`, obj);
  
  if (Array.isArray(obj)) {
    obj.forEach((item, itemIndex) => {
      if (typeof item === 'object' && item !== null) {
        const itemRows = parseComplexObject(item, `${baseKey}_${itemIndex + 1}`, itemIndex + 1);
        rows.push(...itemRows);
      } else {
        rows.push({
          label: `${baseKey} ${itemIndex + 1}`,
          content: [{
            text: String(item),
            value: String(item),
            key: `${baseKey}_${itemIndex + 1}`
          }]
        });
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      rows.push({
        label: `${displayKey} ${index > 0 ? `(${index})` : ''}`,
        content: [{
          text: String(value),
          value: String(value),
          key: `${baseKey}_${key}_${index}`
        }]
      });
    });
  } else {
    rows.push({
      label: baseKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      content: [{
        text: String(obj),
        value: String(obj),
        key: baseKey
      }]
    });
  }
  
  console.log(`Generated ${rows.length} rows for ${baseKey}:`, rows);
  return rows;
};

const DataValidationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const docxInfo = location.state?.docxInfo;
  const docxArrayBufferFromState = location.state?.docxArrayBuffer;
  const fileId = location.state?.fileId;
  const isRoot = location.pathname === '/data-validation';
  const incomingJsonData = location.state?.jsonData;
  const incomingFileName = location.state?.fileName;
  const isLoading = location.state?.isLoading;
  const dataSource = location.state?.source || 'original';

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docxHtml, setDocxHtml] = useState('');
  const [fileType, setFileType] = useState(incomingJsonData ? 'application/json' : '');
  const [docxZoom, setDocxZoom] = useState(1);
  const [isInitializing, setIsInitializing] = useState(false);

  const originalJsonRef = useRef(incomingJsonData || null);
  const [workingJson, setWorkingJson] = useState(() => {
    if (incomingJsonData) {
      try {
        // Handle nested structure for JSON display - show full content including parts
        let jsonToUse = incomingJsonData;
        if (incomingJsonData.content) {
          jsonToUse = incomingJsonData.content;
        }
        // Don't extract just metadata - show full content with parts
        // if (jsonToUse.metadata) {
        //   jsonToUse = jsonToUse.metadata;
        // }
        return JSON.parse(JSON.stringify(jsonToUse));
      } catch (error) {
        console.error('Error parsing incoming JSON data:', error);
        return incomingJsonData;
      }
    }
    return null;
  });

  const [extractedDataState, setExtractedDataState] = useState(() => {
    console.log('=== DataValidationPage Debug Info ===');
    console.log('DataValidationPage - incomingJsonData:', incomingJsonData);
    console.log('DataValidationPage - incomingFileName:', incomingFileName);
    console.log('DataValidationPage - docxInfo:', docxInfo);
    console.log('DataValidationPage - isLoading:', isLoading);
    console.log('DataValidationPage - location.state:', location.state);
    console.log('DataValidationPage - location.state keys:', location.state ? Object.keys(location.state) : 'No location.state');
    
    if (incomingJsonData) {
      console.log('DataValidationPage - incomingJsonData type:', typeof incomingJsonData);
      console.log('DataValidationPage - incomingJsonData keys:', Object.keys(incomingJsonData));
      console.log('DataValidationPage - incomingJsonData content:', incomingJsonData.content);
      console.log('DataValidationPage - incomingJsonData metadata:', incomingJsonData.content?.metadata);
      
      const transformed = transformToRequiredFormat(incomingJsonData);
      console.log('DataValidationPage - transformed data:', transformed);
      console.log('DataValidationPage - transformed nodes count:', transformed?.nodes?.length || 0);
      return transformed;
    }
    console.log('DataValidationPage - No incomingJsonData, returning null');
    console.log('=== End Debug Info ===');
    return null;
  });

  const [canUploadDV, setCanUploadDV] = useState(true);
  const [activeTab, setActiveTab] = useState('extracted');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredJson, setFilteredJson] = useState('');
  const [showValidationBox, setShowValidationBox] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [validationType, setValidationType] = useState('');
  const [comments, setComments] = useState('');
  const selectedFieldRef = useRef(null);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null);
  const [rowFeedback, setRowFeedback] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showValidationForRow, setShowValidationForRow] = useState(null);
  const [isSaving, setIsSaving] = useState(false);


  // DOCX processing function
  const handleDocx = async (arrayBuffer) => {
    const mammoth = await import('mammoth/mammoth.browser');
    return mammoth.convertToHtml({ arrayBuffer });
  };

  // Process DOCX from array buffer
  const renderDocxFromBuffer = async () => {
    try {
      console.log('renderDocxFromBuffer called');
      if (docxArrayBufferFromState) {
        console.log('Processing DOCX from array buffer, size:', docxArrayBufferFromState.byteLength);
        const result = await handleDocx(docxArrayBufferFromState);
        console.log('DOCX conversion result:', result);
        setDocxHtml(result.value);
        setFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        console.log('DOCX HTML set successfully');
      } else {
        console.log('No docxArrayBufferFromState available');
      }
    } catch (err) {
      console.error('DOCX render error:', err);
      setDocxHtml('<p>Could not preview DOCX file.</p>');
    }
  };


  // Process DOCX from info (download from server)
  const loadDocxFromInfo = async () => {
    try {
      console.log('loadDocxFromInfo called with docxInfo:', docxInfo);
      const possibleId = docxInfo?.id || docxInfo?.file?.id || docxInfo?.data?.id || docxInfo?.docx?.id || (Array.isArray(docxInfo) && docxInfo[0]?.id) || docxInfo?.content?.id;
      
      console.log('Extracted possibleId:', possibleId);
      if (!possibleId) throw new Error('No DOCX id available');

      console.log(`Downloading DOCX from ${config.BASE_URL}/api/download/${possibleId}`);
      const response = await fetch(`${config.BASE_URL}/api/download/${possibleId}`);
      console.log('Download response status:', response.status);
      if (!response.ok) throw new Error('Failed to fetch DOCX file');

      const arrayBuffer = await response.arrayBuffer();
      console.log('Downloaded array buffer size:', arrayBuffer.byteLength);
      const result = await handleDocx(arrayBuffer);
      console.log('DOCX conversion result:', result);
      setDocxHtml(result.value);
      setFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      console.log('DOCX HTML set successfully from download');
    } catch (err) {
      console.error('DOCX preview error:', err);
      setDocxHtml('<p>Could not preview DOCX file.</p>');
    }
  };

  // Transform JSON data to the required format for display
  function transformToRequiredFormat(jsonData) {
    if (!jsonData) {
      console.log('No JSON data provided to transformToRequiredFormat');
      return null;
    }
    
    console.log('Transforming JSON data:', jsonData);
    
    // Handle nested structure: if jsonData has a 'content' property, use that
    let actualData = jsonData;
    if (jsonData.content) {
      actualData = jsonData.content;
      console.log('Using content from jsonData:', actualData);
    }
    
    console.log('Final data to transform:', actualData);
    
    const nodes = [];
    
    // Create better labels for common fields
    const labelMap = {
      'document_name': 'Document Name',
      'document_heading': 'Document Heading',
      'document_title': 'Document Title',
      'report_title': 'Report Title',
      'reporting_period': 'Reporting Period',
      'inspection_officer': 'Inspection Officer',
      'departments_inspected': 'Departments Inspected',
      'observations': 'Observations',
      'summary': 'Summary',
      'file_name': 'File Name',
      'file_type': 'File Type',
      'uploaded_at': 'Uploaded At',
      'created_at': 'Created At',
      'updated_at': 'Updated At',
      'Period_of_audit': 'Period of Audit',
      'Date_of_audit': 'Date of Audit',
      'departments': 'Departments',
      'state': 'State',
      'district': 'District',
      'division_name': 'Division Name',
      'audit_objective': 'Audit Objective',
      'audit_criteria': 'Audit Criteria',
      'audite_unit': 'Auditee Unit',
      'expenditure': 'Expenditure',
      'revenue': 'Revenue',
      'budget/allocation': 'Budget/Allocation',
      'Audit_Officer_Details': 'Audit Officer Details',
      'Auditee_Office_Details': 'Auditee Office Details',
      'is_state': 'Is State',
      'signed_by': 'Signed By'
    };
    
    // First, add all metadata fields
    if (actualData.metadata) {
      console.log('Processing metadata:', actualData.metadata);
      Object.entries(actualData.metadata).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          const label = labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          // Check if this is a complex object that should be parsed into separate rows
          if (Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'object' && item !== null)) {
            // This is an array of objects (like Audit_Officer_Details)
            console.log(`Parsing complex array for ${key}:`, value);
            const parsedRows = parseComplexObject(value, key);
            nodes.push(...parsedRows);
          } else if (typeof value === 'object' && !Array.isArray(value) && !(value.Period_From && value.Period_To)) {
            // This is a complex object (but not a period object)
            console.log(`Parsing complex object for ${key}:`, value);
            const parsedRows = parseComplexObject(value, key);
            nodes.push(...parsedRows);
          } else {
            // Handle simple values and special cases
            let displayValue = value;
            
            // Handle arrays with special formatting
            if (Array.isArray(value)) {
              if (value.length === 0) {
                displayValue = 'No data available';
              } else if (value.every(item => typeof item === 'string' || typeof item === 'number')) {
                // Handle simple arrays
                displayValue = value.join(', ');
              } else {
                // Handle mixed arrays
                displayValue = value.map((item, index) => {
                  if (typeof item === 'object') {
                    return `${index + 1}. ${JSON.stringify(item, null, 2)}`;
                  }
                  return `${index + 1}. ${item}`;
                }).join('\n\n');
              }
            }
            // Handle objects
            else if (typeof value === 'object' && !Array.isArray(value)) {
              if (value.Period_From && value.Period_To) {
                // Special handling for period objects
                displayValue = `${value.Period_From} - ${value.Period_To}`;
              } else {
                displayValue = JSON.stringify(value, null, 2);
              }
            }
            
            nodes.push({
              label: label,
              content: [{
                text: displayValue,
                value: displayValue,
                key: key
              }]
            });
          }
        }
      });
    }
    
    // Then, add all parts with their detailed structure
    if (actualData.parts && Array.isArray(actualData.parts)) {
      console.log('Processing parts:', actualData.parts);
      actualData.parts.forEach((part, partIndex) => {
        // Add part title
        nodes.push({
          label: `Part ${partIndex + 1}: ${part.part_title || 'Untitled Part'}`,
          content: [{
            text: part.part_title || 'Untitled Part',
            value: part.part_title || 'Untitled Part',
            key: `part_${partIndex}_title`
          }]
        });
        
        // Add sections within the part
        if (part.sections && Array.isArray(part.sections)) {
          part.sections.forEach((section, sectionIndex) => {
            // Add section title
            nodes.push({
              label: `Section ${sectionIndex + 1}: ${section.section_title || 'Untitled Section'}`,
              content: [{
                text: section.section_title || 'Untitled Section',
                value: section.section_title || 'Untitled Section',
                key: `part_${partIndex}_section_${sectionIndex}_title`
              }]
            });
            
            // Add section content
            if (section.content && Array.isArray(section.content)) {
              section.content.forEach((contentItem, contentIndex) => {
                let contentText = '';
                let isTable = false;
                let tableHtml = '';
                
                if (contentItem.type === 'paragraph') {
                  contentText = contentItem.text || '';
                } else if (contentItem.type === 'table') {
                  contentText = '[Table Content]';
                  isTable = true;
                  tableHtml = contentItem.table || '';
                } else {
                  contentText = JSON.stringify(contentItem, null, 2);
                }
                
                if (contentText.trim()) {
                  nodes.push({
                    label: `Content ${contentIndex + 1}`,
                    content: [{
                      text: contentText,
                      value: contentText,
                      key: `part_${partIndex}_section_${sectionIndex}_content_${contentIndex}`,
                      isTable: isTable,
                      tableHtml: tableHtml
                    }]
                  });
                }
              });
            }
            
            // Add subsections
            if (section.sub_sections && Array.isArray(section.sub_sections)) {
              section.sub_sections.forEach((subSection, subSectionIndex) => {
                // Add subsection title
                nodes.push({
                  label: `Subsection ${subSectionIndex + 1}: ${subSection.sub_section_title || 'Untitled Subsection'}`,
                  content: [{
                    text: subSection.sub_section_title || 'Untitled Subsection',
                    value: subSection.sub_section_title || 'Untitled Subsection',
                    key: `part_${partIndex}_section_${sectionIndex}_subsection_${subSectionIndex}_title`
                  }]
                });
                
                // Add subsection content
                if (subSection.content && Array.isArray(subSection.content)) {
                  subSection.content.forEach((contentItem, contentIndex) => {
                    let contentText = '';
                    let isTable = false;
                    let tableHtml = '';
                    
                    if (contentItem.type === 'paragraph') {
                      contentText = contentItem.text || '';
                    } else if (contentItem.type === 'table') {
                      contentText = '[Table Content]';
                      isTable = true;
                      tableHtml = contentItem.table || '';
                    } else {
                      contentText = JSON.stringify(contentItem, null, 2);
                    }
                    
                    if (contentText.trim()) {
                      nodes.push({
                        label: `Subsection Content ${contentIndex + 1}`,
                        content: [{
                          text: contentText,
                          value: contentText,
                          key: `part_${partIndex}_section_${sectionIndex}_subsection_${subSectionIndex}_content_${contentIndex}`,
                          isTable: isTable,
                          tableHtml: tableHtml
                        }]
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
    
    console.log('Transformed nodes:', nodes);
    return { nodes };
  }

  // Handle search in JSON
  const handleJsonSearch = useCallback((searchValue) => {
    if (!workingJson) return;
    
    const jsonString = JSON.stringify(workingJson, null, 2);
    
    if (!searchValue.trim()) {
      setFilteredJson(jsonString);
      return;
    }
    
    const lines = jsonString.split('\n');
    const filteredLines = lines.filter(line => 
      line.toLowerCase().includes(searchValue.toLowerCase())
    );
    
    setFilteredJson(filteredLines.join('\n'));
  }, [workingJson]);

  useEffect(() => {
    handleJsonSearch(searchTerm);
  }, [searchTerm, handleJsonSearch]);

  // Initialize filtered JSON
  useEffect(() => {
    if (workingJson) {
      setFilteredJson(JSON.stringify(workingJson, null, 2));
    }
  }, [workingJson]);

  // Handle click outside to close validation options
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showValidationForRow && !event.target.closest('.inline-validation-box') && !event.target.closest('.extracted-item-actions')) {
        handleCloseValidation();
      }
    };

    if (showValidationForRow) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showValidationForRow]);

  // Process DOCX file when component mounts
  useEffect(() => {
    const processDocx = async () => {
      console.log('=== DOCX Processing Debug ===');
      console.log('docxArrayBufferFromState:', docxArrayBufferFromState);
      console.log('docxInfo:', docxInfo);
      console.log('docxArrayBufferFromState type:', typeof docxArrayBufferFromState);
      console.log('docxInfo type:', typeof docxInfo);
      
      if (docxArrayBufferFromState) {
        console.log('Processing DOCX from array buffer...');
        await renderDocxFromBuffer();
      } else if (docxInfo) {
        console.log('Processing DOCX from info...');
        await loadDocxFromInfo();
      } else {
        console.log('No DOCX data available for processing');
      }
    };

    processDocx();
  }, [docxArrayBufferFromState, docxInfo]);

  // Track selectedField changes
  useEffect(() => {
    console.log('=== selectedField changed ===');
    console.log('New selectedField:', selectedField);
    console.log('New selectedFieldIndex:', selectedFieldIndex);
    console.log('showValidationBox:', showValidationBox);
  }, [selectedField, selectedFieldIndex, showValidationBox]);

  // Update extractedDataState and workingJson when incomingJsonData changes
  useEffect(() => {
    if (incomingJsonData) {
      console.log('=== Updating extractedDataState and workingJson with new data ===');
      console.log('New incomingJsonData:', incomingJsonData);
      
      // Update extracted data
      const transformed = transformToRequiredFormat(incomingJsonData);
      console.log('New transformed data:', transformed);
      setExtractedDataState(transformed);
      
      // Update working JSON
      try {
        let jsonToUse = incomingJsonData;
        if (incomingJsonData.content) {
          jsonToUse = incomingJsonData.content;
        }
        const jsonCopy = JSON.parse(JSON.stringify(jsonToUse));
        setWorkingJson(jsonCopy);
        console.log('Updated workingJson:', jsonCopy);
      } catch (error) {
        console.error('Error updating workingJson:', error);
      }
    } else if (fileId && !isLoading) {
      // Fallback: try to fetch data directly if not passed via navigation
      console.log('=== No incomingJsonData, trying to fetch data directly ===');
      console.log('fileId:', fileId);
      fetchDataDirectly();
    }
  }, [incomingJsonData, fileId, isLoading]);

  // Fallback function to fetch data directly
  const fetchDataDirectly = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      console.log('Fetching data directly for fileId:', fileId);
      const response = await fetch(`${config.BASE_URL}/api/uploaded-files/${fileId}/content`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Direct fetch response:', data);
        
        if (data.status === 'success' && data.content) {
          const transformed = transformToRequiredFormat(data);
          console.log('Direct fetch transformed data:', transformed);
          setExtractedDataState(transformed);
          
          // Also update workingJson
          try {
            const jsonCopy = JSON.parse(JSON.stringify(data.content));
            setWorkingJson(jsonCopy);
            console.log('Direct fetch updated workingJson:', jsonCopy);
          } catch (error) {
            console.error('Error updating workingJson from direct fetch:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data directly:', error);
    }
  };

  // Redirect if no data is available (but not if still loading)
  useEffect(() => {
    if (!incomingJsonData && !isLoading && !isInitializing) {
      console.log('No data available, redirecting to assigned documents');
      navigate('/assigned-documents');
    }
  }, [incomingJsonData, isLoading, isInitializing, navigate]);

  // Handle feedback for extracted data
  const handleFeedback = useCallback((fieldKey, feedbackType, fieldIndex = null, nodeData = null) => {
    console.log(`=== HANDLE FEEDBACK CALLED ===`);
    console.log(`Field Key: ${fieldKey}`);
    console.log(`Field Index: ${fieldIndex}`);
    console.log(`Feedback Type: ${feedbackType}`);
    console.log(`Node Data:`, nodeData);
    
    if (feedbackType === 'negative') {
      console.log('=== NEGATIVE FEEDBACK DETECTED ===');
      setSelectedField(fieldKey);
      selectedFieldRef.current = fieldKey;
      setSelectedFieldIndex(fieldIndex);
      setShowValidationForRow(fieldKey);
      setValidationType('');
      setComments('');
    } else {
      // Handle positive feedback
      console.log(`Positive feedback for ${fieldKey}`);
      // Update row feedback to show positive feedback
      setRowFeedback(prev => ({
        ...prev,
        [fieldKey]: {
          type: 'positive',
          timestamp: new Date().toISOString(),
          status: 'approved'
        }
      }));
      // Hide validation options for this row
      setShowValidationForRow(null);
    }
  }, []);

  // Handle validation type selection
  const handleValidationType = useCallback((type) => {
    setValidationType(type);
  }, []);

  // Handle comments submission
  const handleCommentsSubmit = useCallback(() => {
    if (!validationType || !comments.trim()) {
      alert('Please select a validation type and provide comments');
      return;
    }

    console.log(`Validation for ${selectedFieldRef.current}: ${validationType} - ${comments}`);
    
    // Replace the original value with the comments text
    updateRowData(selectedFieldRef.current, comments);
    
    // Update row feedback with validation details
    setRowFeedback(prev => ({
      ...prev,
      [selectedFieldRef.current]: {
        type: 'negative',
        validationType: validationType,
        comments: comments,
        timestamp: new Date().toISOString(),
        status: 'needs_review',
        originalValue: prev[selectedFieldRef.current]?.originalValue || comments,
        replacedWithComments: true
      }
    }));

    // Hide validation options and reset state
    setShowValidationForRow(null);
    setSelectedField(null);
    selectedFieldRef.current = null;
    setSelectedFieldIndex(null);
    setValidationType('');
    setComments('');
  }, [validationType, comments]);

  // Close validation options
  const handleCloseValidation = useCallback(() => {
    setShowValidationForRow(null);
    setSelectedField(null);
    selectedFieldRef.current = null;
    setSelectedFieldIndex(null);
    setValidationType('');
    setComments('');
  }, []);

  // Update row data based on feedback
  const updateRowData = useCallback((fieldKey, newValue) => {
    setExtractedDataState(prevState => {
      if (!prevState?.nodes) return prevState;
      
      const updatedNodes = prevState.nodes.map(node => {
        if (node.content[0]?.key === fieldKey) {
          return {
            ...node,
            content: [{
              ...node.content[0],
              text: newValue,
              value: newValue
            }]
          };
        }
        return node;
      });
      
      return { ...prevState, nodes: updatedNodes };
    });
  }, []);

  // Handle edit field
  const handleEditField = useCallback((fieldKey, currentValue) => {
    setEditingField(fieldKey);
    setEditValue(currentValue);
    // Store original value for comparison if not already stored
    setRowFeedback(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        originalValue: prev[fieldKey]?.originalValue || currentValue
      }
    }));
  }, []);

  // Save edited field
  const handleSaveEdit = useCallback(() => {
    if (editingField && editValue.trim()) {
      updateRowData(editingField, editValue);
      
      // Update feedback to show it was edited
      setRowFeedback(prev => ({
        ...prev,
        [editingField]: {
          ...prev[editingField],
          edited: true,
          editTimestamp: new Date().toISOString(),
          newValue: editValue
        }
      }));
      
      setEditingField(null);
      setEditValue('');
    }
  }, [editingField, editValue, updateRowData]);

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Convert current state back to original JSON format
  const convertToOriginalJsonFormat = useCallback(() => {
    if (!extractedDataState?.nodes) return null;

    // Start with the original structure to preserve parts and other data
    const reconstructedJson = JSON.parse(JSON.stringify(incomingJsonData || {}));
    
    // Ensure content structure exists
    if (!reconstructedJson.content) {
      reconstructedJson.content = { metadata: {}, parts: [] };
    }
    if (!reconstructedJson.content.metadata) {
      reconstructedJson.content.metadata = {};
    }

    // Group nodes by their original structure
    const metadataFields = {};

    extractedDataState.nodes.forEach(node => {
      const fieldKey = node.content[0]?.key;
      const value = node.content[0]?.value;

      if (!fieldKey || !value) return;

      // Check if it's a metadata field (not part of parts structure)
      if (!fieldKey.includes('part_') && !fieldKey.includes('section_') && !fieldKey.includes('subsection_')) {
        // Handle complex objects that were parsed into separate fields
        if (fieldKey.includes('_') && fieldKey.split('_').length > 1) {
          const keyParts = fieldKey.split('_');
          const baseKey = keyParts[0];
          const subKey = keyParts.slice(1).join('_');
          
          // Check if this is an array index (e.g., "Audit_Officer_Details_1_Name")
          const lastPart = keyParts[keyParts.length - 1];
          const isArrayIndex = !isNaN(parseInt(lastPart));
          
          if (isArrayIndex) {
            // This is an array item
            const arrayKey = keyParts.slice(0, -1).join('_');
            const arrayIndex = parseInt(lastPart) - 1; // Convert to 0-based index
            
            if (!metadataFields[arrayKey]) {
              metadataFields[arrayKey] = [];
            }
            if (!metadataFields[arrayKey][arrayIndex]) {
              metadataFields[arrayKey][arrayIndex] = {};
            }
            
            // Get the property name (second to last part)
            const propertyName = keyParts[keyParts.length - 2];
            metadataFields[arrayKey][arrayIndex][propertyName] = value;
          } else {
            // This is a nested object property
            if (!metadataFields[baseKey]) {
              metadataFields[baseKey] = {};
            }
            metadataFields[baseKey][subKey] = value;
          }
        } else {
          // Simple field
          metadataFields[fieldKey] = value;
        }
      }
    });

    // Merge with existing metadata, preserving original structure
    reconstructedJson.content.metadata = {
      ...reconstructedJson.content.metadata,
      ...metadataFields
    };

    return reconstructedJson;
  }, [extractedDataState, incomingJsonData]);

  // Save and submit changes
  const handleSaveAndSubmit = useCallback(async () => {
    if (!fileId) {
      alert('No file ID available for saving');
      return;
    }

    setIsSaving(true);
    
    try {
      // Convert current state to original JSON format
      const updatedJson = convertToOriginalJsonFormat();
      
      if (!updatedJson) {
        alert('No data to save');
        setIsSaving(false);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to save changes');
        setIsSaving(false);
        return;
      }

      console.log('Saving updated JSON:', updatedJson);

      const response = await fetch(`${config.BASE_URL}/api/save-validation-changes?file_id=${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedJson)
      });

      const result = await response.json();

      if (response.ok) {
        alert('Changes saved successfully!');
        console.log('Save result:', result);
      } else {
        alert(`Failed to save changes: ${result.detail || 'Unknown error'}`);
        console.error('Save error:', result);
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      alert(`Error saving changes: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [fileId, convertToOriginalJsonFormat]);

  // Render extracted data items - only re-render when data changes
  const renderExtractedItems = useMemo(() => {
    console.log('renderExtractedItems - extractedDataState:', extractedDataState);
    console.log('renderExtractedItems - extractedDataState?.nodes:', extractedDataState?.nodes);
    
    if (!extractedDataState?.nodes) {
      console.log('renderExtractedItems - No nodes available, showing empty state');
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#666',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <p>No extracted data available</p>
          <small>Data will be displayed here when available</small>
        </div>
      );
    }
    
    console.log('renderExtractedItems - Rendering', extractedDataState.nodes.length, 'nodes');

    return extractedDataState.nodes.map((node, index) => {
      // Create a unique key for each field
      const fieldKey = node.content[0]?.key || `field_${index}`;
      const uniqueKey = `${fieldKey}_${index}`;
      
      return (
        <ExtractedItemRow
          key={uniqueKey}
          node={node}
          index={index}
          fieldKey={fieldKey}
          uniqueKey={uniqueKey}
        />
      );
    });
  }, [extractedDataState]);

  // Show loading state if data is being loaded
  if (isLoading) {
    return (
      <div className="data-validation-page" style={{ marginTop: "6rem" }}>
        <Container fluid className="py-4">
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white text-center">
              <h5 className="mb-0">
                <i className="fas fa-file-alt me-2"></i>
                Data Validation
              </h5>
            </Card.Header>
            <Card.Body className="text-center py-5">
              <Spinner animation="border" role="status" size="lg">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <h5 className="mt-3">Loading document data...</h5>
              <p className="text-muted">Please wait while we prepare the validation interface.</p>
            </Card.Body>
          </Card>
        </Container>
      </div>
    );
  }

  // Context value for sharing state
  const contextValue = useMemo(() => ({
    rowFeedback,
    selectedField,
    showValidationForRow,
    validationType,
    comments,
    editingField,
    editValue,
    isSaving,
    handleFeedback,
    handleValidationType,
    handleCommentsSubmit,
    handleCloseValidation,
    handleEditField,
    handleSaveEdit,
    handleCancelEdit,
    handleSaveAndSubmit,
    setEditValue,
    setComments
  }), [
    rowFeedback,
    selectedField,
    showValidationForRow,
    validationType,
    comments,
    editingField,
    editValue,
    isSaving,
    handleFeedback,
    handleValidationType,
    handleCommentsSubmit,
    handleCloseValidation,
    handleEditField,
    handleSaveEdit,
    handleCancelEdit,
    handleSaveAndSubmit,
    setEditValue,
    setComments
  ]);

  return (
    <ValidationContext.Provider value={contextValue}>
      <style>{`
        .data-validation-page {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: #f7fbff;
        }
        
        .top-navigation {
          background: white;
          border-bottom: 1px solid #e0e0e0;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .nav-buttons {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        
        .nav-button {
          padding: 8px 16px;
          border: 1px solid #0D61AE;
          border-radius: 6px;
          background: white;
          color: #0D61AE;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .nav-button:hover {
          background: #0D61AE;
          color: white;
        }
        
        .nav-button.primary {
          background: #0D61AE;
          color: white;
        }
        
        .nav-button.primary:hover {
          background: #0056b3;
        }
        
        .submit-section {
          background: white;
          border-bottom: 1px solid #e0e0e0;
          padding: 12px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .feedback-summary {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .feedback-count {
          display: flex;
          align-items: center;
          font-size: 14px;
          font-weight: 500;
          padding: 6px 12px;
          background: #f8f9fa;
          border-radius: 20px;
          border: 1px solid #e0e0e0;
        }
        
        .submit-button {
          background: #0D61AE;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .submit-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .submit-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.7;
        }
        
        .main-content {
          display: flex;
          flex: 1;
          height: calc(100vh - 140px);
        }
        
        .document-viewer {
          width: 50%;
          background: white;
          border-right: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
        }
        
        .document-header {
          padding: 16px 24px;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
        }
        
        .document-title {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin: 0;
        }
        
        .document-content {
          flex: 1;
          padding: 24px;
          overflow: auto;
          background: #f9f9f9;
        }
        
        .document-preview {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          padding: 24px;
          min-height: 600px;
        }
        
        .extracted-panel {
          width: 50%;
          background: white;
          display: flex;
          flex-direction: column;
        }
        
        .extracted-header {
          padding: 16px 24px;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
        }
        
        .tab-container {
          display: flex;
          background: #e9ecef;
          border-radius: 6px;
          padding: 4px;
          margin-bottom: 16px;
        }
        
        .tab-button {
          flex: 1;
          padding: 8px 16px;
          border: none;
          background: transparent;
          color: #666;
          font-weight: 500;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .tab-button.active {
          background: white;
          color: #0D61AE;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .search-container {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: white;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }
        
        .search-input {
          border: none;
          background: none;
          outline: none;
          flex: 1;
          font-size: 14px;
        }
        
        .extracted-content {
          flex: 1;
          padding: 24px;
          overflow: auto;
        }
        
        .extracted-item {
          margin-bottom: 16px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          position: relative;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .extracted-item.selected {
          border: 2px solid #007bff;
          box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }
        
        .extracted-item-header {
          background: #f8f9fa;
          padding: 12px 16px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .extracted-item-title {
          font-size: 12px;
          font-weight: 600;
          color: #0D61AE;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .extracted-item-actions {
          display: flex;
          gap: 4px;
        }
        
        .extracted-item-content {
          padding: 16px;
          font-size: 14px;
          color: #666;
          line-height: 1.4;
        }
        
        .extracted-item-value {
          margin-bottom: 0;
          padding: 0;
          background: transparent;
          border-radius: 0;
          border-left: none;
        }
        
        .value-label {
          font-weight: 600;
          color: #0D61AE;
          margin-bottom: 8px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
        }
        
        .value-content {
          color: #333;
          line-height: 1.5;
          word-wrap: break-word;
          font-size: 14px;
          background: #f8f9fa;
          padding: 12px;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }
        
        .json-content {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 16px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          white-space: pre-wrap;
          overflow: auto;
          max-height: 500px;
        }
        
        .footer {
          background: white;
          border-top: 1px solid #e0e0e0;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #666;
        }
        
        .highlight {
          background-color: #fff3cd;
          padding: 1px 3px;
          border-radius: 3px;
        }
        
        .inline-validation-box {
          background: #f8f9fa;
          border: 2px solid #007bff;
          border-radius: 8px;
          padding: 16px;
          margin-top: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .validation-buttons {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        
        .validation-btn {
          padding: 6px 12px;
          border: 1px solid #e0e0e0;
          background: white;
          color: #666;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
          min-width: 70px;
          text-align: center;
        }
        
        .validation-btn:hover {
          background: #f8f9fa;
          border-color: #007bff;
        }
        
        .validation-btn.selected {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }
        
        .comments-section {
          margin-bottom: 16px;
        }
        
        .comments-label {
          font-size: 12px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
          display: block;
        }
        
        .comments-textarea {
          width: 100%;
          min-height: 60px;
          padding: 8px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          box-sizing: border-box;
        }
        
        .validation-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 12px;
        }
        
        .validation-action-btn {
          padding: 6px 12px;
          border: 1px solid #e0e0e0;
          background: white;
          color: #666;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
          min-width: 50px;
          text-align: center;
        }
        
        .validation-action-btn:hover {
          background: #f8f9fa;
          border-color: #007bff;
        }
        
        .validation-action-btn.validation-submit {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }
        
        .validation-action-btn.validation-submit:hover {
          background: #0056b3;
          border-color: #0056b3;
        }
        
        .validation-action-btn.validation-submit:disabled {
          background: #adb5bd;
          border-color: #adb5bd;
          cursor: not-allowed;
        }
        
        .validation-action-btn.validation-cancel {
          background: #6c757d;
          color: white;
          border-color: #6c757d;
        }
        
        .validation-action-btn.validation-cancel:hover {
          background: #545b62;
          border-color: #545b62;
        }

        /* Feedback Status Styles */
        .feedback-status {
          margin-top: 12px;
          padding: 12px;
          border-radius: 6px;
          border-left: 4px solid;
        }

        .positive-feedback {
          background-color: #d4edda;
          border-left-color: #28a745;
          color: #155724;
        }

        .negative-feedback {
          background-color: #f8d7da;
          border-left-color: #dc3545;
          color: #721c24;
        }

        .feedback-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .feedback-type {
          font-weight: 600;
          font-size: 14px;
        }

        .feedback-timestamp {
          font-size: 12px;
          opacity: 0.8;
          margin-left: auto;
        }

        .feedback-details {
          font-size: 13px;
          line-height: 1.4;
        }

        .feedback-validation-type,
        .feedback-comments {
          margin-bottom: 4px;
        }


        /* Edit Field Styles */
        .value-display {
          position: relative;
        }

        .edit-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 10;
        }

        .value-display:hover .edit-btn {
          opacity: 1;
        }

        .edit-field-container {
          background: #f8f9fa;
          border: 2px solid #007bff;
          border-radius: 6px;
          padding: 12px;
        }

        .edit-textarea {
          width: 100%;
          min-height: 80px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          margin-bottom: 12px;
        }

        .edit-textarea:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .feedback-edit-info,
        .feedback-replacement-info {
          margin-top: 8px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 4px;
          font-size: 12px;
        }

        .replacement-comparison {
          margin-top: 8px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          border-left: 3px solid #dc3545;
        }

        .replacement-comparison div {
          margin-bottom: 4px;
        }

        .replacement-comparison div:last-child {
          margin-bottom: 0;
        }

        .edit-comparison {
          margin-top: 8px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          border-left: 3px solid #007bff;
        }

        .edit-comparison div {
          margin-bottom: 4px;
        }

        .edit-comparison div:last-child {
          margin-bottom: 0;
        }
        
        .table-container {
          overflow-x: auto;
          margin: 8px 0;
        }
        
        .table-container table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #ddd;
          font-size: 14px;
        }
        
        .table-container th,
        .table-container td {
          border: 1px solid #ddd;
          padding: 8px 12px;
          text-align: left;
        }
        
        .table-container th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #333;
        }
        
        .table-container tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        .table-container tr:hover {
          background-color: #f5f5f5;
        }
        
        .validation-action-btn {
          padding: 6px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        }
        
        .validation-cancel {
          background: #6c757d;
          color: white;
        }
        
        .validation-submit {
          background: #dc3545;
          color: white;
        }
        
        .validation-submit:disabled {
          background: #adb5bd;
          cursor: not-allowed;
        }
        
        /* DOCX Content Styles */
        .docx-content {
          font-family: 'Times New Roman', serif;
          line-height: 1.6;
          color: #333;
        }
        
        .docx-content h1, .docx-content h2, .docx-content h3, .docx-content h4, .docx-content h5, .docx-content h6 {
          color: #0D61AE;
          margin-top: 24px;
          margin-bottom: 12px;
        }
        
        .docx-content p {
          margin-bottom: 12px;
        }
        
        .docx-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }
        
        .docx-content table td, .docx-content table th {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        
        .docx-content table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        
        .docx-content ul, .docx-content ol {
          margin: 12px 0;
          padding-left: 24px;
        }
        
        .docx-content li {
          margin-bottom: 4px;
        }
      `}</style>

      <TopNavbar />
      
      <div style={{ marginTop: '85px', height: 'calc(100vh - 85px)' }}>
        <div style={{ height: '100%', width: '100%' }}>
            
            {/* Top Navigation */}
            <div className="top-navigation">
              <div className="nav-buttons">
                <button 
                  className="nav-button"
                  onClick={() => navigate('/home')}
                >
                  <i className="fas fa-arrow-left me-1"></i>
                  Home
                </button>
                <button 
                  className="nav-button primary"
                  onClick={() => navigate('/bulk-upload')}
                >
                  Upload New
                </button>
              </div>
              
              <div className="submit-section">
                <div className="feedback-summary">
                  <span className="feedback-count">
                    <i className="fas fa-thumbs-up me-1" style={{ color: '#28a745' }}></i>
                    Approved: {Object.values(rowFeedback).filter(f => f.type === 'positive').length}
                  </span>
                  <span className="feedback-count">
                    <i className="fas fa-thumbs-down me-1" style={{ color: '#dc3545' }}></i>
                    Needs Review: {Object.values(rowFeedback).filter(f => f.type === 'negative').length}
                  </span>
                  <span className="feedback-count">
                    <i className="fas fa-edit me-1" style={{ color: '#007bff' }}></i>
                    Edited: {Object.values(rowFeedback).filter(f => f.edited).length}
                  </span>
                </div>
                <button 
                  className="submit-button"
                  onClick={handleSaveAndSubmit}
                  disabled={isSaving}
                >
                  <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'} me-2`}></i>
                  {isSaving ? 'Saving...' : 'Save & Submit'}
                </button>
              </div>
          
            </div>

            {/* Main Content */}
            <div className="main-content">
              {isLoading ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100%',
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <Spinner animation="border" size="lg" className="mb-3" />
                    <p>Loading data validation page...</p>
                    <small>Please wait while we load the document and extracted data</small>
                  </div>
                </div>
              ) : (
                <>
                  {/* Left Side - Document Viewer */}
                  <div className="document-viewer">
                    <div className="document-header">
                      <h6 className="document-title">{incomingFileName || 'Document'}</h6>
                    </div>
                    <div className="document-content">
                      <div className="document-preview">
                        {docxHtml ? (
                          <div 
                            className="docx-content"
                            style={{ 
                              background: 'white', 
                              padding: '24px', 
                              borderRadius: '8px',
                              minHeight: '600px',
                              border: '1px solid #e0e0e0',
                              overflow: 'auto'
                            }}
                            dangerouslySetInnerHTML={{ __html: docxHtml }}
                          />
                        ) : (
                          <div style={{ 
                            background: 'white', 
                            padding: '24px', 
                            borderRadius: '8px',
                            minHeight: '600px',
                            border: '1px solid #e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#666'
                          }}>
                            {isLoading ? (
                              <div style={{ textAlign: 'center' }}>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Loading document...
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center' }}>
                                <p>No document available</p>
                                <small>Document will be displayed here when available</small>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Extracted Data Panel */}
                  <div className="extracted-panel">
                    <div className="extracted-header">
                      <div className="tab-container">
                        <button 
                          className={`tab-button ${activeTab === 'extracted' ? 'active' : ''}`}
                          onClick={() => setActiveTab('extracted')}
                        >
                          Extracted
                        </button>
                        <button 
                          className={`tab-button ${activeTab === 'json' ? 'active' : ''}`}
                          onClick={() => setActiveTab('json')}
                        >
                          JSON
                        </button>
                      </div>
                      
                      <div className="search-container">
                        <i className={`fas ${activeTab === 'extracted' ? 'fa-filter' : 'fa-search'} me-2`} style={{ color: '#666' }}></i>
                        <input
                          type="text"
                          className="search-input"
                          placeholder={activeTab === 'extracted' ? 'Search extracted data...' : 'Search JSON...'}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="extracted-content">
                      {activeTab === 'extracted' && (
                        <div>
                          {renderExtractedItems}
                        </div>
                      )}
                      
                  {activeTab === 'json' && (
                    <div className="json-content">
                      {workingJson ? (filteredJson || JSON.stringify(workingJson, null, 2)) : (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '40px', 
                          color: '#666',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <p>No JSON data available</p>
                          <small>Data will be displayed here when available</small>
                          <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
                            Debug: workingJson = {workingJson ? 'exists' : 'null'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="footer">
              <div>© 2025 Pravartak - All Rights Reserved.</div>
              <div>
                <a href="#" style={{ color: '#666', textDecoration: 'none', marginRight: '16px' }}>Privacy Policy</a>
                <a href="#" style={{ color: '#666', textDecoration: 'none' }}>Cookies</a>
              </div>
            </div>
        </div>
      </div>
    </ValidationContext.Provider>
  );
};

export default DataValidationPage;
