import React, { useState, useRef, useEffect } from 'react';
import { Container, Card, Row, Col, Button, Alert, ListGroup, Badge, Spinner, InputGroup, FormControl, Table, Dropdown } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import axios from 'axios';
import config from '../config.js';
import '../styles/dashboard.scss';

const BulkUpload = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'upload', 'view-files'

  // Update currentView based on URL path
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/bulk-upload/upload')) {
      setCurrentView('upload');
    } else if (path.includes('/bulk-upload/view-files')) {
      setCurrentView('view-files');
    } else {
      setCurrentView('dashboard');
    }
  }, [location.pathname]);

  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [convertingFiles, setConvertingFiles] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [canUploadFolder, setCanUploadFolder] = useState(true);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Filter states
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterAssignment, setFilterAssignment] = useState('');

  // Dashboard stats - will be calculated from real data
  const [dashboardStats, setDashboardStats] = useState({
    assigned: 0,
    unassigned: 0,
    pendingValidation: 0,
    overdue: 0,
    completed: 0
  });

  // Real uploaded files from database
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);

  // File assignment states
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignStatus, setAssignStatus] = useState(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  // Function to get assignment information for files
  const getAssignmentInfo = async (fileIds) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.BASE_URL}/api/file-assignments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_ids: fileIds })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.assignments || {};
      }
      return {};
    } catch (error) {
      console.error('Error fetching assignment info:', error);
      return {};
    }
  };

  // Update dashboard stats based on documents
  useEffect(() => {
    const stats = {
      assigned: documents.filter(doc => doc.assignedTo && doc.assignedTo !== '—' && doc.assignedTo !== null).length,
      unassigned: documents.filter(doc => !doc.assignedTo || doc.assignedTo === '—' || doc.assignedTo === null).length,
      pendingValidation: documents.filter(doc => doc.status === 'Pending Validation' || doc.status === 'uploaded').length,
      overdue: documents.filter(doc => doc.status === 'Overdue').length,
      completed: documents.filter(doc => doc.status === 'Completed' || doc.status === 'processed').length
    };
    setDashboardStats(stats);
  }, [documents]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setPermissionsLoaded(true);
      return;
    }
    fetch(`${config.BASE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];
        const allowUpload = perms.includes('bulk_upload:create');
        setCanUploadFolder(!!allowUpload);
      })
      .catch(() => {
        setCanUploadFolder(false);
      })
      .finally(() => setPermissionsLoaded(true));
  }, []);

  // Fetch users for assignment
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const token = localStorage.getItem('token');
      console.log('Fetching users from:', `${config.BASE_URL}/admin/users/all`);
      
      // Try admin endpoint first
      let response = await fetch(`${config.BASE_URL}/admin/users/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('Admin users response status:', response.status);
      
      if (!response.ok) {
        console.log('Admin endpoint failed, trying /api/users');
        // Fallback to /api/users endpoint
        response = await fetch(`${config.BASE_URL}/api/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('API users response status:', response.status);
      }
      
      if (response.ok) {
        const data = await response.json();
        console.log('Users data received:', data);
        
        // Handle different response formats
        let usersList = [];
        if (Array.isArray(data)) {
          usersList = data;
        } else if (data.users && Array.isArray(data.users)) {
          usersList = data.users;
        }
        
        // Transform data to ensure consistent format
        const transformedUsers = usersList.map(user => ({
          id: user.id,
          name: user.name || user.username || `${user.firstname || ''} ${user.lastname || ''}`.trim() || `User ${user.id}`,
          email: user.email || user.email_address || 'No email'
        }));
        
        console.log('Transformed users:', transformedUsers);
        setUsers(transformedUsers);
      } else {
        console.error('Failed to fetch users:', response.status, response.statusText);
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  // Load existing uploaded files on component mount
  useEffect(() => {
    const loadUploadedFiles = async () => {
      setDocumentsLoading(true);
      try {
        const response = await fetch(`${config.BASE_URL}/api/uploaded-files`);
        if (response.ok) {
          const data = await response.json();
          if (data.files && Array.isArray(data.files)) {
            // Get assignment information for all files
            const assignmentInfo = await getAssignmentInfo(data.files.map(f => f.id));
            
            const existingDocuments = data.files.map(file => {
              // Extract metadata from JSON if available
              let documentName = file.filename;
              let department = 'Uploaded';
              let year = new Date(file.uploaded_at).getFullYear().toString();
              let state = 'Tamilnadu';
              
              if (file.extracted_json && typeof file.extracted_json === 'object') {
                // Use extracted metadata from JSON
                // Handle both simple and structured JSON formats
                if (file.extracted_json.metadata) {
                  // Structured JSON format (from full pipeline)
                  // Use the original filename as document name
                  documentName = file.filename;
                  
                  // Extract department from JSON structure
                  if (file.extracted_json.metadata.departments && file.extracted_json.metadata.departments !== null) {
                    department = file.extracted_json.metadata.departments;
                  } else {
                    // If departments is null, try to extract from document heading
                    if (file.extracted_json.metadata.document_heading) {
                      const heading = file.extracted_json.metadata.document_heading.toLowerCase();
                      if (heading.includes('registry')) {
                        department = 'Sub Registry';
                      } else if (heading.includes('commercial')) {
                        department = 'Commercial';
                      } else if (heading.includes('revenue')) {
                        department = 'Revenue';
                      } else if (heading.includes('accountant general') || heading.includes('audit')) {
                        department = 'Accountant General';
                      } else {
                        department = 'Uploaded';
                      }
                    } else {
                      department = 'Uploaded';
                    }
                  }
                  
                  // Extract period range if available
                  if (file.extracted_json.metadata.Period_of_audit?.Period_From && file.extracted_json.metadata.Period_of_audit?.Period_To) {
                    year = `${file.extracted_json.metadata.Period_of_audit.Period_From} - ${file.extracted_json.metadata.Period_of_audit.Period_To}`;
                  } else if (file.extracted_json.metadata.Period_of_audit?.Period_From) {
                    year = file.extracted_json.metadata.Period_of_audit.Period_From;
                  } else if (file.extracted_json.metadata.Period_of_audit?.Period_To) {
                    year = file.extracted_json.metadata.Period_of_audit.Period_To;
                  } else if (file.extracted_json.metadata.Date_of_audit?.Period_From) {
                    // Try to extract year from Date_of_audit
                    const dateStr = file.extracted_json.metadata.Date_of_audit.Period_From;
                    const yearMatch = dateStr.match(/(\d{4})/);
                    if (yearMatch) {
                      year = yearMatch[1];
                    } else {
                      year = new Date(file.uploaded_at).getFullYear().toString();
                    }
                  } else {
                    // Look for year in document heading or content
                    const heading = file.extracted_json.metadata.document_heading || '';
                    const yearMatch = heading.match(/(\d{4})/);
                    if (yearMatch) {
                      year = yearMatch[1];
                    } else {
                      year = new Date(file.uploaded_at).getFullYear().toString();
                    }
                  }
                  state = file.extracted_json.metadata.state || 'Tamilnadu';
                } else {
                  // Simple JSON format (from simple processor)
                  documentName = file.filename;
                  department = file.extracted_json.department || 'Uploaded';
                  year = file.extracted_json.year ? file.extracted_json.year.toString() : new Date(file.uploaded_at).getFullYear().toString();
                  state = file.extracted_json.state || 'Tamilnadu';
                }
              }
              
              // Get assignment info for this file
              const fileAssignment = assignmentInfo[file.id];
              const assignedTo = fileAssignment ? fileAssignment.user_name : '—';
              const assignedOn = fileAssignment ? fileAssignment.assigned_at : '—';
              
              return {
                id: file.id,
                name: documentName,
                department: department,
                year: year,
                state: state,
                assignedTo: assignedTo,
                assignedOn: assignedOn,
                modification: '—',
                status: file.status === 'processed' ? 'Completed' : 'Unassigned',
                severity: '—',
                file_type: file.file_type ? file.file_type.toUpperCase() : 'Unknown',
                file_size: file.file_size || 0,
                uploaded_at: file.uploaded_at ? file.uploaded_at.split('T')[0] : new Date().toISOString().split('T')[0]
              };
            });
            
            // Replace dummy data with real data
            setDocuments(existingDocuments);
          } else {
            setDocuments([]);
          }
        } else {
          setDocuments([]);
        }
      } catch (error) {
        console.log('Could not load existing files:', error);
        // Keep empty array if API fails
        setDocuments([]);
      } finally {
        setDocumentsLoading(false);
      }
    };

    loadUploadedFiles();
  }, []);

  const formatErrorMessage = (error) => {
    try {
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) {
        return detail.map(d => d?.msg || JSON.stringify(d)).join('; ');
      }
      if (typeof detail === 'object' && detail !== null) {
        return detail?.msg || JSON.stringify(detail);
      }
      return detail || error?.message || 'Unexpected error';
    } catch (_) {
      return 'Unexpected error';
    }
  };

  // Filter functions
  const getUniqueValues = (field) => {
    const values = new Set();
    documents.forEach(doc => {
      const value = doc[field];
      if (value && value !== '—' && value !== 'N/A') {
        values.add(value);
      }
    });
    return Array.from(values).sort();
  };

  const clearFilters = () => {
    setSearch('');
    setFilterState('');
    setFilterDepartment('');
    setFilterAssignment('');
  };

  const applyFilters = () => {
    // This will trigger a re-render with the current filter values
    // The filtering logic will be applied in the render function
  };

  // Handle file row click to navigate to DataValidationPage
  const handleFileRowClick = async (doc) => {
    try {
      console.log('Clicked file:', doc);
      
      // Fetch the file details and JSON data from the API
      const response = await fetch(`${config.BASE_URL}/api/uploaded-files/${doc.id}`);
      if (response.ok) {
        const fileData = await response.json();
        console.log('Fetched file data:', fileData);
        
        const navigationState = {
          fileId: doc.id,
          fileName: doc.name,
          jsonData: fileData.extracted_json,
          docxInfo: {
            id: doc.id,
            name: doc.name,
            department: doc.department,
            year: doc.year,
            state: doc.state,
            status: doc.status,
            assignedTo: doc.assignedTo,
            uploaded_at: doc.uploaded_at
          },
          isLoading: false,
          source: 'original'
        };
        
        console.log('Navigating with state:', navigationState);
        
        // Navigate to DataValidationPage with the file data
        navigate('/data-validation', {
          state: navigationState
        });
      } else {
        console.error('Failed to fetch file details:', response.statusText);
        // Still navigate but with limited data
        navigate('/data-validation', {
          state: {
            fileId: doc.id,
            fileName: doc.name,
            jsonData: null,
            docxInfo: {
              id: doc.id,
              name: doc.name,
              department: doc.department,
              year: doc.year,
              state: doc.state,
              status: doc.status,
              assignedTo: doc.assignedTo,
              uploaded_at: doc.uploaded_at
            },
            isLoading: false,
            source: 'original'
          }
        });
      }
    } catch (error) {
      console.error('Error fetching file details:', error);
      // Navigate with available data
      navigate('/data-validation', {
        state: {
          fileId: doc.id,
          fileName: doc.name,
          jsonData: null,
          docxInfo: {
            id: doc.id,
            name: doc.name,
            department: doc.department,
            year: doc.year,
            state: doc.state,
            status: doc.status,
            assignedTo: doc.assignedTo,
            uploaded_at: doc.uploaded_at
          },
          isLoading: false,
          source: 'original'
        }
      });
    }
  };
  
  // Count active filters (excluding search since it's separate)
  const getActiveFilterCount = () => {
    let count = 0;
    if (filterState) count++;
    if (filterDepartment) count++;
    if (filterAssignment) count++;
    return count;
  };

  // Filter documents based on current filter values
  const filteredDocuments = documents.filter(doc => {
    // Search filter
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase();
      const matchesSearch = 
        doc.name.toLowerCase().includes(searchTerm) ||
        doc.department.toLowerCase().includes(searchTerm) ||
        doc.state.toLowerCase().includes(searchTerm) ||
        doc.year.toString().includes(searchTerm);
      if (!matchesSearch) return false;
    }

    // State filter
    if (filterState && doc.state !== filterState) {
      return false;
    }

    // Department filter
    if (filterDepartment && doc.department !== filterDepartment) {
      return false;
    }

    // Assignment status filter
    if (filterAssignment) {
      if (filterAssignment === 'assigned' && doc.assignedTo === '—') {
        return false;
      }
      if (filterAssignment === 'unassigned' && doc.assignedTo !== '—') {
        return false;
      }
    }

    return true;
  });

  const validateFiles = (files) => {
    const allowedTypes = ['.json', '.csv', '.xlsx', '.xls', '.pdf', '.txt', '.docx'];
    const validFiles = [];
    const invalidFiles = [];

    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().includes('.docx') || allowedTypes.some(ext => file.name.toLowerCase().endsWith(ext))) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    return { validFiles, invalidFiles };
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { validFiles, invalidFiles } = validateFiles(files);

    if (invalidFiles.length > 0) {
      setUploadStatus({
        type: 'warning',
        message: `Selected ${validFiles.length} valid file(s). Invalid files: ${invalidFiles.join(', ')}`
      });
    } else {
      setUploadStatus({
        type: 'success',
        message: `Added ${validFiles.length} file(s) to the selection`
      });
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setFolderName('');
      setSelectedFolder(null);
    }
  };

  const handleFolderSelect = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      const { validFiles, invalidFiles } = validateFiles(files);
      
      if (validFiles.length > 0) {
        const firstFilePath = validFiles[0].webkitRelativePath || validFiles[0].name;
        const folderPath = firstFilePath.split('/');
        const extractedFolderName = folderPath.length > 1 ? folderPath[0] : 'Uploaded Folder';
        setFolderName(extractedFolderName);
        setSelectedFolder(validFiles);
      }
      
      if (invalidFiles.length > 0) {
        setUploadStatus({
          type: 'warning',
          message: `Selected folder with ${validFiles.length} valid files. Invalid files: ${invalidFiles.join(', ')}`
        });
      } else {
        setUploadStatus({
          type: 'success',
          message: `Successfully selected folder with ${validFiles.length} file(s)`
        });
      }
      
      if (validFiles.length > 0) {
        setSelectedFiles([]);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '#e3f2fd';
    e.currentTarget.style.borderColor = '#2196f3';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '#f8f9fa';
    e.currentTarget.style.borderColor = '#007bff';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '#f8f9fa';
    e.currentTarget.style.borderColor = '#007bff';
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const { validFiles, invalidFiles } = validateFiles(files);
      
      if (invalidFiles.length > 0) {
        setUploadStatus({
          type: 'warning',
          message: `Uploaded ${validFiles.length} valid files via drag and drop. Invalid files: ${invalidFiles.join(', ')}`
        });
      } else {
        setUploadStatus({
          type: 'success',
          message: `Successfully selected ${validFiles.length} file(s) via drag and drop`
        });
      }
      
      if (validFiles.length > 0) {
        setSelectedFiles(validFiles);
        setFolderName('');
        setSelectedFolder(null);
      }
    }
  };

  const uploadFilesToDatabase = async () => {
    if (selectedFiles.length === 0) {
      setUploadStatus({
        type: 'warning',
        message: 'No files selected for upload'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setConvertingFiles(true);
    setConversionProgress(0);
    setCurrentProcessingFile('Preparing files for processing...');

    try {
      const formData = new FormData();
      selectedFiles.forEach((file, index) => {
        formData.append('files', file);
      });

      const response = await axios.post(`${config.BASE_URL}/api/bulk-process-documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000,
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      if (response.data.status === 'success') {
        const { results, errors, total_files, word_documents } = response.data;
        
        setCurrentProcessingFile('Processing complete!');
        setTimeout(() => setCurrentProcessingFile(''), 2000);
        
        if (errors && errors.length > 0) {
          const errorDetails = errors.map(error => {
            if (typeof error === 'object' && error !== null) {
              const filename = error.filename || 'Unknown file';
              const step = error.step_failed || 'Unknown step';
              const errorMsg = error.error || error.message || 'Unknown error';
              return `${filename} (${step}): ${errorMsg}`;
            }
            return String(error);
          }).join('; ');
          
          setUploadStatus({
            type: 'warning',
            message: `Processed ${results.length} files successfully, but ${errors.length} files failed. Errors: ${errorDetails}`
          });
        } else {
          setUploadStatus({
            type: 'success',
            message: `Successfully processed ${total_files} files (${word_documents} Word documents converted to JSON)`
          });
        }

        const newUploadedFiles = results.map(result => ({
          id: result.file_id || Date.now() + Math.random(),
          name: result.filename,
          size: 0,
          type: 'processed',
          uploadedAt: new Date().toISOString(),
          status: result.status === 'processed' ? 'Success' : result.status
        }));

        // Add to uploadedFiles for upload view
        setUploadedFiles(prev => [...newUploadedFiles, ...prev]);

        // Refresh the documents list from the API
        const refreshDocuments = async () => {
          try {
            const response = await fetch(`${config.BASE_URL}/api/uploaded-files`);
            if (response.ok) {
              const data = await response.json();
              if (data.files && Array.isArray(data.files)) {
                // Get assignment information for all files
                const assignmentInfo = await getAssignmentInfo(data.files.map(f => f.id));
                
                const existingDocuments = data.files.map(file => {
                  // Get assignment info for this file
                  const fileAssignment = assignmentInfo[file.id];
                  const assignedTo = fileAssignment ? fileAssignment.user_name : '—';
                  const assignedOn = fileAssignment ? fileAssignment.assigned_at : '—';

                  return {
                  id: file.id,
                  name: file.filename,
                  department: 'Uploaded',
                  year: new Date(file.uploaded_at).getFullYear().toString(),
                  state: 'Tamilnadu',
                    assignedTo: assignedTo,
                    assignedOn: assignedOn,
                  modification: '—',
                  status: file.status === 'processed' ? 'Completed' : 'Unassigned',
                  severity: '—',
                  file_type: file.file_type ? file.file_type.toUpperCase() : 'Unknown',
                  file_size: file.file_size || 0,
                  uploaded_at: file.uploaded_at ? file.uploaded_at.split('T')[0] : new Date().toISOString().split('T')[0]
                  };
                });
                setDocuments(existingDocuments);
              }
            }
          } catch (error) {
            console.log('Could not refresh documents:', error);
          }
        };

        // Refresh documents list
        refreshDocuments();
      } else {
        throw new Error('Bulk processing failed');
      }

      setSelectedFiles([]);
      setFolderName('');
      setSelectedFolder(null);
      setUploadProgress(0);

    } catch (error) {
      console.error('Upload error:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
        errorMessage = 'CORS error: Please check if the backend server is running and CORS is properly configured.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setUploadStatus({
        type: 'danger',
        message: `Failed to process files: ${errorMessage}`
      });
    } finally {
      setIsUploading(false);
      setConvertingFiles(false);
      setConversionProgress(0);
      setCurrentProcessingFile('');
      setSelectedFiles([]); // Clear selected files after upload
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setSelectedFolder(null);
    setFolderName('');
    setUploadStatus(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'json':
        return 'fas fa-file-code text-warning';
      case 'csv':
        return 'fas fa-file-csv text-success';
      case 'xlsx':
      case 'xls':
        return 'fas fa-file-excel text-success';
      case 'pdf':
        return 'fas fa-file-pdf text-danger';
      case 'txt':
        return 'fas fa-file-alt text-info';
      default:
        return 'fas fa-file text-secondary';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return <Badge bg="success">{status}</Badge>;
      case 'Unassigned':
        return <Badge bg="warning">{status}</Badge>;
      case 'Overdue':
        return <Badge bg="danger">{status}</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'High':
        return <Badge bg="danger">{severity}</Badge>;
      case 'Medium':
        return <Badge bg="warning">{severity}</Badge>;
      case 'Low':
        return <Badge bg="success">{severity}</Badge>;
      default:
        return <span className="text-muted">—</span>;
    }
  };

  const getAssignmentStatusBadge = (assignedTo) => {
    if (assignedTo && assignedTo !== '—') {
      return <Badge bg="success">Assigned</Badge>;
    } else {
      return <Badge bg="warning">Unassigned</Badge>;
    }
  };

  // Handle file selection for assignment
  const handleFileSelection = (fileId, isSelected) => {
    if (isSelected) {
      setSelectedFiles(prev => [...prev, fileId]);
    } else {
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
    }
  };

  // Handle select all files for assignment
  const handleSelectAllFiles = (isSelected) => {
    if (isSelected) {
      const unassignedFiles = filteredDocuments
        .filter(doc => !doc.assignedTo || doc.assignedTo === '—')
        .map(doc => doc.id);
      setSelectedFiles(unassignedFiles);
    } else {
      setSelectedFiles([]);
    }
  };

  // Handle file download
  const handleDownload = async (fileId, fileName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${config.BASE_URL}/api/uploaded-files/${fileId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setUploadStatus({ type: 'danger', msg: 'Failed to download file. Please try again.' });
    }
  };

  // Open assignment modal
  const handleOpenAssignModal = () => {
    if (selectedFiles.length === 0) {
      setAssignStatus({ type: 'warning', msg: 'Please select at least one document to assign.' });
      return;
    }
    fetchUsers();
    setShowAssignModal(true);
  };

  const assignFilesToUser = async () => {
    if (!selectedUser || selectedFiles.length === 0) {
      setAssignStatus({ type: 'warning', msg: 'Select a user and at least one document.' });
      return;
    }
    
    // Check if any selected files are already assigned to any user
    const alreadyAssignedFiles = selectedFiles.filter(fileId => {
      const file = documents.find(f => f.id === fileId);
      return file && file.assignedTo && file.assignedTo !== '—';
    });
    
    if (alreadyAssignedFiles.length > 0) {
      setAssignStatus({ type: 'warning', msg: 'Some selected documents are already assigned to users. Please select unassigned documents.' });
      return;
    }
    try {
      setAssignLoading(true);
      setAssignStatus(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${config.BASE_URL}/admin/assign-files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_ids: [selectedUser.id],
          file_ids: selectedFiles
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.created && data.created > 0) {
          setAssignStatus({ type: 'success', msg: `Assigned successfully. New links: ${data.created}. Please refresh the Assigned Documents page to see the new assignment.` });
        setSelectedFiles([]);
          setShowAssignModal(false);
          setSelectedUser(null);
      } else {
          setAssignStatus({ type: 'warning', msg: 'Assignment completed but no new assignments were created. File might already be assigned.' });
        }
        // Refresh the documents list
        const refreshDocuments = async () => {
          try {
            const response = await fetch(`${config.BASE_URL}/api/uploaded-files`);
            if (response.ok) {
              const data = await response.json();
              if (data.files && Array.isArray(data.files)) {
                // Get assignment information for all files
                const assignmentInfo = await getAssignmentInfo(data.files.map(f => f.id));
                
                const existingDocuments = data.files.map(file => {
                  let documentName = file.filename;
                  let department = 'Uploaded';
                  let year = new Date(file.uploaded_at).getFullYear().toString();
                  let state = 'Tamilnadu';
                  
                  if (file.extracted_json && typeof file.extracted_json === 'object') {
                    if (file.extracted_json.metadata) {
                      documentName = file.filename;
                      if (file.extracted_json.metadata.departments && file.extracted_json.metadata.departments !== null) {
                        department = file.extracted_json.metadata.departments;
                      } else {
                        if (file.extracted_json.metadata.document_heading) {
                          const heading = file.extracted_json.metadata.document_heading.toLowerCase();
                          if (heading.includes('registry')) {
                            department = 'Sub Registry';
                          } else if (heading.includes('commercial')) {
                            department = 'Commercial';
                          } else if (heading.includes('revenue')) {
                            department = 'Revenue';
                          } else if (heading.includes('accountant general') || heading.includes('audit')) {
                            department = 'Accountant General';
                          } else {
                            department = 'Uploaded';
                          }
                        } else {
                          department = 'Uploaded';
                        }
                      }
                      
                      if (file.extracted_json.metadata.Period_of_audit?.Period_From && file.extracted_json.metadata.Period_of_audit?.Period_To) {
                        year = `${file.extracted_json.metadata.Period_of_audit.Period_From} - ${file.extracted_json.metadata.Period_of_audit.Period_To}`;
                      } else if (file.extracted_json.metadata.Period_of_audit?.Period_From) {
                        year = file.extracted_json.metadata.Period_of_audit.Period_From;
                      } else if (file.extracted_json.metadata.Period_of_audit?.Period_To) {
                        year = file.extracted_json.metadata.Period_of_audit.Period_To;
                      } else if (file.extracted_json.metadata.Date_of_audit?.Period_From) {
                        const dateStr = file.extracted_json.metadata.Date_of_audit.Period_From;
                        const yearMatch = dateStr.match(/(\d{4})/);
                        if (yearMatch) {
                          year = yearMatch[1];
                        } else {
                          year = new Date(file.uploaded_at).getFullYear().toString();
                        }
                      } else {
                        const heading = file.extracted_json.metadata.document_heading || '';
                        const yearMatch = heading.match(/(\d{4})/);
                        if (yearMatch) {
                          year = yearMatch[1];
                        } else {
                          year = new Date(file.uploaded_at).getFullYear().toString();
                        }
                      }
                      state = file.extracted_json.metadata.state || 'Tamilnadu';
                    } else {
                      documentName = file.filename;
                      department = file.extracted_json.department || 'Uploaded';
                      year = file.extracted_json.year ? file.extracted_json.year.toString() : new Date(file.uploaded_at).getFullYear().toString();
                      state = file.extracted_json.state || 'Tamilnadu';
                    }
                  }
                  
                  // Get assignment info for this file
                  const fileAssignment = assignmentInfo[file.id];
                  const assignedTo = fileAssignment ? fileAssignment.user_name : '—';
                  const assignedOn = fileAssignment ? fileAssignment.assigned_at : '—';

                  return {
                    id: file.id,
                    name: documentName,
                    department: department,
                    year: year,
                    state: state,
                    assignedTo: assignedTo,
                    assignedOn: assignedOn,
                    modification: '—',
                    status: file.status === 'processed' ? 'Completed' : 'Unassigned',
                    severity: '—',
                    file_type: file.file_type ? file.file_type.toUpperCase() : 'Unknown',
                    file_size: file.file_size || 0,
                    uploaded_at: file.uploaded_at ? file.uploaded_at.split('T')[0] : new Date().toISOString().split('T')[0]
                  };
                });
                setDocuments(existingDocuments);
              }
            }
          } catch (error) {
            console.log('Could not refresh documents:', error);
          }
        };
        refreshDocuments();
      } else {
        setAssignStatus({ type: 'danger', msg: data.detail || `Failed to assign files. Status: ${response.status}` });
      }
    } catch (err) {
      console.error('Error assigning files:', err);
      setAssignStatus({ type: 'danger', msg: `Error assigning files: ${err.message}` });
    } finally {
      setAssignLoading(false);
    }
  };

  const renderDashboard = () => (
    <div>
      {/* Greeting */}
      <h2 className="dashboard-heading">Good Morning Sarav!</h2>

      {/* Summary Cards */}
         <div className="dashboard-stats-contain">
          <div className="dashboard-stats">
              <div className="stat-card">
                  <div className="stat-icon assigned">
                  <i className="fas fa-file-arrow-up"></i>
                  </div>
                  <div className="stat-content">
                  <p className="stat-count">{dashboardStats.assigned}</p>
                  <p className="stat-label">Assigned</p>
                  </div>
              </div>
              
              <div className="stat-card">
                  <div className="stat-icon unassigned">
                  <i className="fas fa-file"></i>
                  </div>
                  <div className="stat-content">
                  <p className="stat-count">{dashboardStats.unassigned}</p>
                  <p className="stat-label">Unassigned</p>
                  </div>
              </div>
              
              <div className="stat-card">
                  <div className="stat-icon pending">
                  <i className="fas fa-clock"></i>
                  </div>
                  <div className="stat-content">
                  <p className="stat-count">{dashboardStats.pendingValidation}</p>
                  <p className="stat-label">Pending Validation</p>
                  </div>
              </div>
              
              <div className="stat-card">
                  <div className="stat-icon overdue">
                  <i className="fas fa-exclamation-triangle"></i>
                  </div>
                  <div className="stat-content">
                  <p className="stat-count">{dashboardStats.overdue}</p>
                  <p className="stat-label">Overdue</p>
                  </div>
              </div>
              
              <div className="stat-card">
                  <div className="stat-icon completed">
                  <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="stat-content">
                  <p className="stat-count">{dashboardStats.completed}</p>
                  <p className="stat-label">Completed</p>
                  </div>
              </div>
              
              <div className="dashboard-buttons">
                  <button 
                      className="btn-add-document"
                      onClick={() => navigate('/bulk-upload/upload')}
                  >
                      <i className="fas fa-upload"></i>
                Add Document
                  </button>
                  <button 
                      className="btn-assign-document"
                      onClick={() => navigate('/bulk-upload/view-files')}
                  >
                      <i className="fas fa-user-plus"></i>
                Assign Document
                  </button>
            </div>
          </div>
         </div>

      {/* Documents Table */}
      <Card className="shadow-sm table-card">
        <Card.Header className="bg-white">
          <Row className="align-items-center">
            <Col md={6}>
              <h5 className="mb-0 table-heading">All Documents</h5>
            </Col>
            <Col md={6}>
               <div className="d-flex gap-3 align-items-center justify-content-end">
                 <Dropdown>
                   <Dropdown.Toggle variant="outline-secondary" className="filter-btn">
                  <i className="fas fa-filter me-2"></i>
                  Filters
                     {getActiveFilterCount() > 0 && (
                       <Badge bg="primary" className="ms-2" style={{ fontSize: '10px' }}>
                         {getActiveFilterCount()}
                       </Badge>
                     )}
                   </Dropdown.Toggle>
                   <Dropdown.Menu className="p-3" style={{ minWidth: '280px' }}>
                     <div className="mb-3">
                       <label className="form-label fw-semibold">Filter by State</label>
                       <FormControl
                         as="select"
                         value={filterState}
                         onChange={(e) => setFilterState(e.target.value)}
                         className="form-select"
                       >
                         <option value="">All States</option>
                         {getUniqueValues('state').map(state => (
                           <option key={state} value={state}>{state}</option>
                         ))}
                       </FormControl>
                     </div>
                     
                     <div className="mb-3">
                       <label className="form-label fw-semibold">Filter by Department</label>
                       <FormControl
                         as="select"
                         value={filterDepartment}
                         onChange={(e) => setFilterDepartment(e.target.value)}
                         className="form-select"
                       >
                         <option value="">All Departments</option>
                         {getUniqueValues('department').map(dept => (
                           <option key={dept} value={dept}>{dept}</option>
                         ))}
                       </FormControl>
                     </div>
                     
                     <div className="mb-3">
                       <label className="form-label fw-semibold">Filter by Assignment Status</label>
                       <FormControl
                         as="select"
                         value={filterAssignment}
                         onChange={(e) => setFilterAssignment(e.target.value)}
                         className="form-select"
                       >
                         <option value="">All Status</option>
                         <option value="assigned">Assigned</option>
                         <option value="unassigned">Unassigned</option>
                       </FormControl>
                     </div>
                     
                     <div className="d-flex gap-2">
                       <Button 
                         variant="primary" 
                         size="sm" 
                         onClick={applyFilters}
                         className="flex-fill"
                       >
                         Apply Filters
                </Button>
                       <Button 
                         variant="outline-secondary" 
                         size="sm" 
                         onClick={clearFilters}
                         className="flex-fill"
                       >
                         Clear All
                       </Button>
                     </div>
                   </Dropdown.Menu>
                 </Dropdown>
                 <div className="search-input-group" style={{ width: '300px' }}>
                   <InputGroup>
                     <FormControl 
                       placeholder="Search documents..." 
                       value={search}
                       onChange={(e) => setSearch(e.target.value)}
                     />
                <InputGroup.Text>
                  <i className="fas fa-search"></i>
                </InputGroup.Text>
              </InputGroup>
                 </div>
               </div>
            </Col>
          </Row>
        </Card.Header>
        <Card.Body className="p-0">
          {/* Filter Summary */}
          {getActiveFilterCount() > 0 && (
            <div className="p-3 bg-light border-bottom">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className="fas fa-filter text-primary"></i>
                  <span className="text-muted">
                    Showing {filteredDocuments.length} of {documents.length} documents
                  </span>
                  {search && search.trim() && (
                    <Badge bg="info" className="ms-2">
                      Search: "{search}"
                    </Badge>
                  )}
                  {filterState && (
                    <Badge bg="secondary" className="ms-1">
                      State: {filterState}
                    </Badge>
                  )}
                  {filterDepartment && (
                    <Badge bg="secondary" className="ms-1">
                      Dept: {filterDepartment}
                    </Badge>
                  )}
                  {filterAssignment && (
                    <Badge bg="secondary" className="ms-1">
                      Status: {filterAssignment}
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="outline-danger" 
                  size="sm" 
                  onClick={clearFilters}
                >
                  <i className="fas fa-times me-1"></i>
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
          <div className="view-files-table-container">
            <Table responsive hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>S.NO</th>
                  <th>Document Name</th>
                  <th>Department</th>
                  <th>Year</th>
                  <th>State</th>
                  <th>Assigned to</th>
                  <th>Assigned on</th>
                  <th>Modification</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documentsLoading ? (
                  <tr>
                    <td colSpan="11" className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading documents...
                    </td>
                  </tr>
                ) : filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-4 text-muted">
                      <i className="fas fa-file-alt fa-2x mb-2 d-block"></i>
                      {documents.length === 0 ? 'No documents uploaded yet' : 'No documents match your filters'}
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc, index) => (
                  <tr key={doc.id}>
                      <td className="text-center fw-medium text-muted">
                      {index + 1}
                    </td>
                    <td className="fw-medium">{doc.name}</td>
                    <td>{doc.department}</td>
                    <td>{doc.year}</td>
                    <td>{doc.state}</td>
                    <td>{doc.assignedTo}</td>
                    <td>{doc.assignedOn}</td>
                    <td>{doc.modification}</td>
                    <td className="badge-style">{getStatusBadge(doc.status)}</td>
                    <td>{getSeverityBadge(doc.severity)}</td>
                    <td>
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => handleDownload(doc.id, doc.name)}
                        title="Download file"
                      >
                        <i className="fas fa-download"></i>
                      </Button>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
        <Card.Footer className="bg-light">
          <Row className="align-items-center">
            <Col md={6}>
              <div className="d-flex align-items-center gap-3">
                <span className="text-muted">Go to</span>
                <FormControl 
                  type="number" 
                  style={{ width: '60px' }} 
                  defaultValue="10"
                />
                <span className="text-muted">page</span>
              </div>
            </Col>
            <Col md={6}>
              <div className="d-flex justify-content-end gap-2">
                <Button className="page-button" variant="outline-primary" size="sm">
                  <i className="fas fa-angle-left"></i>
                </Button>
                <Button className="page-button" variant="primary" size="sm">1</Button>
                <Button className="page-button" variant="outline-primary" size="sm">2</Button>
                <Button className="page-button" variant="outline-primary" size="sm">3</Button>
                <Button className="page-button" variant="outline-primary" size="sm">4</Button>
                <Button className="page-button" variant="outline-primary" size="sm">
                  <i className="fas fa-angle-right"></i>
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Footer>
      </Card>
    </div>
  );

  const renderUploadView = () => (
    <div>
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                navigate('/bulk-upload');
              }}
              className="text-decoration-none"
            >
              Home
            </a>
          </li>
          <li className="breadcrumb-item active">Upload document</li>
        </ol>
      </nav>
      
    <Card className="shadow-sm">
      <Card.Header className="text-white text-left">
        <h5 className="mb-0">
          Upload document
        </h5>
      </Card.Header>
      <Card.Body>
        {uploadStatus && (
          <Alert variant={uploadStatus.type} onClose={() => setUploadStatus(null)} dismissible>
            {uploadStatus.message}
          </Alert>
        )}
        
        {/* Dynamic Layout - Full width when no files, split when files selected */}
        {selectedFiles.length === 0 ? (
          /* Full Width - No Files Selected */
          <div className="pb-5">
            <div
              className="upload-area p-5 border-2 border-dashed rounded" 
              style={{
                borderColor: '#E8E8E8',
                backgroundColor: '#f8f9fa',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <i className="fas fa-file-upload fa-3x text-muted mb-3"></i>
              <h5 className="mb-3 text-muted">Drag files here</h5>
              <p className="text-muted mb-4">
                or <span className="text-primary" style={{ cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>browse your computer</span>
              </p>
              <small className="text-muted d-block mb-3">Allowed types: .json, .csv, .xlsx, .xls, .pdf, .txt, .docx</small>
              
              <div className="d-flex gap-3 justify-content-center">
                <div>
                  {canUploadFolder && (
                    <>
                      <input
                        type="file"
                        multiple
                        webkitdirectory=""
                        directory=""
                        onChange={handleFolderSelect}
                        style={{ display: 'none' }}
                        id="folder-select"
                        ref={folderInputRef}
                      />
                      <label htmlFor="folder-select">
                        <Button variant="primary" as="span" disabled={isUploading || convertingFiles}>
                          <i className="fas fa-folder-open me-2"></i>
                          Select Folder
                        </Button>
                      </label>
                    </>
                  )}
                </div>
                
                <div>
                  <input
                    type="file"
                    multiple
                    accept=".json,.csv,.xlsx,.xls,.pdf,.txt,.docx"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="file-upload"
                    ref={fileInputRef}
                  />
                  <label htmlFor="file-upload">
                    <Button variant="outline-primary" as="span" disabled={isUploading || convertingFiles}>
                      <i className="fas fa-file me-2"></i>
                      Select Files
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Split Layout - Files Selected */
          <Row className="pb-5">
            {/* Left Column - File Drop Zone */}
            <Col md={6}>
              <div
                className="upload-area p-5 border-2 border-dashed rounded h-100" 
                style={{
                  borderColor: '#E8E8E8',
                  backgroundColor: '#f8f9fa',
                  minHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <i className="fas fa-file-upload fa-3x text-muted mb-3"></i>
                <h5 className="mb-3 text-muted">Drag files here</h5>
                <p className="text-muted mb-4">
                  or <span className="text-primary" style={{ cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>browse your computer</span>
                </p>
                <small className="text-muted d-block mb-3">Allowed types: .json, .csv, .xlsx, .xls, .pdf, .txt, .docx</small>
                
                <div className="d-flex gap-3 justify-content-center">
                  <div>
                    {canUploadFolder && (
                      <>
                        <input
                          type="file"
                          multiple
                          webkitdirectory=""
                          directory=""
                          onChange={handleFolderSelect}
                          style={{ display: 'none' }}
                          id="folder-select"
                          ref={folderInputRef}
                        />
                        <label htmlFor="folder-select">
                          <Button variant="primary" as="span" disabled={isUploading || convertingFiles}>
                            <i className="fas fa-folder-open me-2"></i>
                            Select Folder
                          </Button>
                        </label>
                      </>
                    )}
                  </div>
                  
                  <div>
                    <input
                      type="file"
                      multiple
                      accept=".json,.csv,.xlsx,.xls,.pdf,.txt,.docx"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      id="file-upload"
                      ref={fileInputRef}
                    />
                    <label htmlFor="file-upload">
                      <Button variant="outline-primary" as="span" disabled={isUploading || convertingFiles}>
                        <i className="fas fa-file me-2"></i>
                        Select Files
                      </Button>
                    </label>
                  </div>
                </div>
              </div>
            </Col>

            {/* Right Column - Files Uploading Progress */}
            <Col md={6}>
              <div className="h-100 d-flex flex-column">
                <h5 className="text-muted mb-3">Files uploading</h5>
                
                {/* Individual File Progress */}
                <div className="flex-grow-1">
                  {selectedFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="d-flex align-items-center mb-3 p-3">
                      {/* File Icon */}
                      <div className="me-3">
                        <img 
                          src="/src/assets/ExcelFile_Icon.png" 
                          alt="File" 
                          style={{ width: '35px', height: '39px' }}
                        />
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="flex-grow-1 me-3">
                        <div className="progress" style={{ height: '8px' }}>
                          <div 
                            className="progress-bar" 
                            role="progressbar" 
                            style={{ 
                              width: isUploading ? `${uploadProgress}%` : '0%',
                              backgroundColor: '#007bff'
                            }}
                            aria-valuenow={isUploading ? uploadProgress : 0} 
                            aria-valuemin="0" 
                            aria-valuemax="100"
                          ></div>
                        </div>
                      </div>
                      
                      {/* Percentage */}
                      <div className="me-3">
                        <span className="text-muted">{isUploading ? `${uploadProgress}%` : '0%'}</span>
                      </div>
                      
                      {/* Delete Icon */}
                      <div>
                        <i 
                          className="fas fa-trash text-muted" 
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== index))}
                        ></i>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Action Buttons */}
                <div className="d-flex gap-2 mt-auto import-btn-header">
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    onClick={() => setSelectedFiles([])}
                    disabled={isUploading || convertingFiles}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={uploadFilesToDatabase} disabled={isUploading || convertingFiles}>
                    Import
                  </Button>
                </div>
              </div>
            </Col>
          </Row>

        )}

        {/* Selected Files List - Show before upload */}
        {selectedFiles.length > 0 && !isUploading && (
          <div className="mt-4">
            <h6 className="mb-3 text-muted">Selected Files ({selectedFiles.length})</h6>
            <div className="selected-files-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="d-flex justify-content-between align-items-center p-2 border rounded mb-2 bg-light">
                  <div className="d-flex align-items-center">
                    <i className={`${getFileIcon(file.name)} me-2 text-primary`}></i>
                    <span className="fw-medium">{file.name}</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg="info">{file.department || 'Unknown'}</Badge>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => {
                        const newSelectedFiles = selectedFiles.filter((_, i) => i !== index);
                        setSelectedFiles(newSelectedFiles);
                      }}
                      title="Remove file"
                    >
                      <i className="fas fa-times"></i>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Folder List */}
          {canUploadFolder && selectedFolder && selectedFolder.length > 0 && (
            <div className="mt-4">
              <Card className="shadow-sm">
                <Card.Header className="bg-info text-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-0">
                        <i className="fas fa-folder me-2"></i>
                        Selected Folder: {folderName} ({selectedFolder.length} files)
                      </h6>
                      <small>Click "Upload Folder" to upload all files to database</small>
                    </div>
                    <div className="d-flex gap-2">
                      <Button 
                        variant="outline-light" 
                        onClick={clearSelection}
                        disabled={isUploading || convertingFiles}
                        size="sm"
                      >
                        <i className="fas fa-times me-1"></i>
                        Clear
                      </Button>
                      {canUploadFolder && (
                        <Button 
                          variant="warning" 
                          onClick={uploadFilesToDatabase}
                          disabled={isUploading || convertingFiles}
                        >
                          <i className="fas fa-folder-upload me-2"></i>
                          Upload Folder to Database
                        </Button>
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  <ListGroup variant="flush">
                    {selectedFolder.map((file, index) => (
                      <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                          <i className={`${getFileIcon(file.name)} me-3`} style={{ fontSize: '1.2rem' }}></i>
                          <div>
                            <strong>{file.webkitRelativePath || file.name}</strong>
                            <br />
                            <small className="text-muted">
                              {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                            </small>
                          </div>
                        </div>
                        <Badge bg="info">In Folder</Badge>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </Card.Body>
              </Card>
            </div>
          )}
      </Card.Body>
    </Card>
     </div>
  );

  const renderViewFiles = () => {
  return (
      <div>
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/bulk-upload');
                }}
                className="text-decoration-none"
              >
                Home
              </a>
            </li>
            <li className="breadcrumb-item active">View Files</li>
          </ol>
        </nav>
        
        <h2 className="mb-4">View Files</h2>
        
        {/* Filter Summary */}
        {getActiveFilterCount() > 0 && (
          <div className="mb-3 p-3 bg-light rounded">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="fas fa-filter text-primary"></i>
                <span className="text-muted">
                  Showing {filteredDocuments.length} of {documents.length} files
                </span>
                {search && search.trim() && (
                  <Badge bg="info" className="ms-2">
                    Search: "{search}"
                  </Badge>
                )}
                {filterState && (
                  <Badge bg="secondary" className="ms-1">
                    State: {filterState}
                  </Badge>
                )}
                {filterDepartment && (
                  <Badge bg="secondary" className="ms-1">
                    Department: {filterDepartment}
                  </Badge>
                )}
                {filterAssignment && (
                  <Badge bg="secondary" className="ms-1">
                    Status: {filterAssignment}
                  </Badge>
                )}
              </div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="filter-btn"
                onClick={clearFilters}
              >
                Clear All Filters
              </Button>
            </div>
          </div>
        )}

        {/* Files List */}
        <Card className="shadow-sm">
          <Card.Header className="bg-white border-bottom">
            <Row className="align-items-center">
              <Col md={4}>
                <h5 className="mb-0">Uploaded Files ({filteredDocuments.length})</h5>
              </Col>
              <Col md={8}>
                <div className="d-flex gap-2 align-items-center justify-content-end">
                  {/* Search Input */}
                  <div className="search-input-group" style={{ width: '250px' }}>
                    <InputGroup size="sm">
                      <FormControl 
                        placeholder="Search files..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <InputGroup.Text>
                        <i className="fas fa-search"></i>
                      </InputGroup.Text>
                    </InputGroup>
                  </div>
                  
                  {/* Filter Dropdown */}
                  <Dropdown>
                    <Dropdown.Toggle 
                      variant="outline-secondary" 
                      size="sm"
                      className="d-flex align-items-center filter-btn"
                    >
                      <i className="fas fa-filter me-2"></i>
                      Filter
                      {getActiveFilterCount() > 0 && (
                        <Badge bg="warning" className="ms-2">
                          {getActiveFilterCount()}
                        </Badge>
                      )}
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="p-3" style={{ minWidth: '300px' }}>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Filter by State</label>
                        <FormControl
                          as="select"
                          value={filterState}
                          onChange={(e) => setFilterState(e.target.value)}
                          className="form-select"
                        >
                          <option value="">All States</option>
                          {getUniqueValues('state').map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </FormControl>
                  </div>
                      
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Filter by Department</label>
                        <FormControl
                          as="select"
                          value={filterDepartment}
                          onChange={(e) => setFilterDepartment(e.target.value)}
                          className="form-select"
                        >
                          <option value="">All Departments</option>
                          {getUniqueValues('department').map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </FormControl>
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Filter by Assignment Status</label>
                        <FormControl
                          as="select"
                          value={filterAssignment}
                          onChange={(e) => setFilterAssignment(e.target.value)}
                          className="form-select"
                        >
                          <option value="">All Status</option>
                          <option value="assigned">Assigned</option>
                          <option value="unassigned">Unassigned</option>
                        </FormControl>
                      </div>
                      
                      <div className="d-flex gap-2">
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={applyFilters}
                          className="flex-fill filter-btn"
                        >
                          Apply Filters
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          size="sm" 
                          onClick={clearFilters}
                          className="flex-fill filter-btn"
                        >
                          Clear All
                        </Button>
                      </div>
                    </Dropdown.Menu>
                  </Dropdown>
                  
                  {/* Assign Files Button */}
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={handleOpenAssignModal}
                    disabled={selectedFiles.length === 0}
                  >
                    <i className="fas fa-user-plus me-2"></i>
                    Assign Files ({selectedFiles.length})
                  </Button>
                </div>
              </Col>
            </Row>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="view-files-table-container">
              <Table responsive hover className="mb-0 view-files-table">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '40px' }}>
                    <input 
                      type="checkbox" 
                      onChange={(e) => handleSelectAllFiles(e.target.checked)}
                      checked={selectedFiles.length > 0 && selectedFiles.length === filteredDocuments.filter(doc => !doc.assignedTo || doc.assignedTo === '—').length}
                    />
                  </th>
                    <th>Document Name</th>
                    <th>Department</th>
                    <th>Year</th>
                    <th>State</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                </tr>
              </thead>
               <tbody>
                 {documentsLoading ? (
                   <tr>
                     <td colSpan="8" className="text-center py-4">
                       <Spinner animation="border" size="sm" className="me-2" />
                       Loading files...
                     </td>
                   </tr>
                 ) : filteredDocuments.length === 0 ? (
                   <tr>
                     <td colSpan="8" className="text-center py-4 text-muted">
                       <i className="fas fa-upload fa-2x mb-2 d-block"></i>
                       {documents.length === 0 ? 'No files uploaded yet. Upload some files to get started!' : 'No files match your filters'}
                     </td>
                   </tr>
                 ) : (
                   filteredDocuments.map((doc) => (
                     <tr 
                        key={doc.id} 
                      >
                       <td>
                         <input 
                           type="checkbox" 
                           checked={selectedFiles.includes(doc.id)}
                           onChange={(e) => handleFileSelection(doc.id, e.target.checked)}
                           disabled={doc.assignedTo && doc.assignedTo !== '—'}
                         />
                       </td>
                       <td className="fw-medium">
                         <i className={`${getFileIcon(doc.name)} me-2`}></i>
                         {doc.name}
                       </td>
                       <td>
                         <Badge bg="info">{doc.department}</Badge>
                       </td>
                       <td>
                         <span className="text-muted">{doc.year}</span>
                       </td>
                        <td className="badge-style">
                          <Badge bg="secondary">{doc.state}</Badge>
                        </td>
                        <td>{getAssignmentStatusBadge(doc.assignedTo)}</td>
                        <td>{doc.assignedTo}</td>
                     </tr>
                   ))
                 )}
               </tbody>
            </Table>
            </div>
                </Card.Body>
          <Card.Footer className="bg-light">
            <Row className="align-items-center">
              <Col md={6}>
                <div className="d-flex align-items-center gap-3">
                  <span className="text-muted">Show</span>
                  <FormControl 
                    as="select" 
                    style={{ width: '80px' }}
                    defaultValue="10"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </FormControl>
                  <span className="text-muted">entries</span>
                </div>
            </Col>
              <Col md={6}>
                <div className="d-flex justify-content-end gap-2">
                  <Button 
                    variant="outline-primary" 
                    size="sm" className="page-button"
                  >
                    <i className="fas fa-angle-left"></i>
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm"
                    className="page-button"
                  >
                    1
                  </Button>
                  <Button 
                    variant="outline-primary" className="page-button" size="sm"
                  >
                    2
                  </Button>
                  <Button 
                    variant="outline-primary" className="page-button" size="sm">
                    3
                  </Button>
                  <Button 
                    variant="outline-primary" 
                    className="page-button" size="sm"
                  >
                    <i className="fas fa-angle-right"></i>
                  </Button>
                </div>
              </Col>
            </Row>
          </Card.Footer>
        </Card>
      </div>
    );
  };

  return (
    <div className="container-fluid py-4">
              {currentView === 'dashboard' && renderDashboard()}
              {currentView === 'upload' && renderUploadView()}
              {currentView === 'view-files' && renderViewFiles()}
              
              {/* Assignment Modal */}
              {showAssignModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                      <div className="modal-header">
                        <h5 className="modal-title">Assign Files to User</h5>
                        <button 
                          type="button" 
                          className="btn-close" 
                          onClick={() => {
                            setShowAssignModal(false);
                            setSelectedUser(null);
                            setAssignStatus(null);
                          }}
                        ></button>
                      </div>
                      <div className="modal-body">
                        {assignStatus && (
                          <Alert variant={assignStatus.type} onClose={() => setAssignStatus(null)} dismissible>
                            {assignStatus.msg}
                          </Alert>
                        )}
                        
                        <div className="mb-3">
                          <label className="form-label">Select User</label>
                          <FormControl
                            as="select"
                            value={selectedUser?.id || ''}
                            onChange={(e) => {
                              const userId = e.target.value;
                              const user = users.find(u => u.id === parseInt(userId));
                              setSelectedUser(user);
                            }}
                            className="form-select"
                          >
                            <option value="">Choose a user...</option>
                            {usersLoading ? (
                              <option disabled>Loading users...</option>
                            ) : users.length === 0 ? (
                              <option disabled>No users available</option>
                            ) : (
                              users.map(user => (
                                <option key={user.id} value={user.id}>
                                  {user.name} ({user.email})
                                </option>
                              ))
                            )}
                          </FormControl>
                          {usersLoading && (
                            <small className="text-muted">Loading users...</small>
                          )}
                          {!usersLoading && users.length === 0 && (
                            <small className="text-muted">No users available</small>
                          )}
                        </div>
                        
                        <div className="mb-3">
                          <label className="form-label">Selected Files ({selectedFiles.length})</label>
                          <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {selectedFiles.map(fileId => {
                              const file = documents.find(d => d.id === fileId);
                              return file ? (
                                <div key={fileId} className="d-flex justify-content-between align-items-center py-1">
                                  <span>
                                    <i className={`${getFileIcon(file.name)} me-2`}></i>
                                    {file.name}
                                  </span>
                                  <Badge bg="info">{file.department}</Badge>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <Button 
                          variant="secondary" 
                          onClick={() => {
                            setShowAssignModal(false);
                            setSelectedUser(null);
                            setAssignStatus(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="primary" 
                          onClick={assignFilesToUser}
                          disabled={!selectedUser || assignLoading || selectedFiles.length === 0}
                        >
                          {assignLoading ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-2" />
                              Assigning...
                            </>
                            ) : (
                              `Assign ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`
                            )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
      </div>
  );
};

export default BulkUpload;
