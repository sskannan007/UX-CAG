import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Alert, Spinner, Row, Col, FormControl, InputGroup, Table, Badge, Pagination, Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config.js';
import '../styles/dashboard.scss';
import { apiRequest, isAuthenticated, logout } from '../utils/apiUtils.js';

const AssignedDocuments = () => {
  const navigate = useNavigate();
  const [assignedFiles, setAssignedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState({});
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchCurrentUser();
    fetchAssignedFiles();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const userData = await apiRequest(`${config.BASE_URL}/api/users/me`);
      setCurrentUser(userData);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const testAssignedFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Testing assigned files endpoint...');
      
      // First test the table creation
      const createResponse = await axios.post(`${config.BASE_URL}/api/create-assignment-table`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Table creation response:', createResponse.data);
      
      // Then test the assigned files endpoint
      const testResponse = await axios.get(`${config.BASE_URL}/api/test-assigned-files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Test response:', testResponse.data);
      
      alert(`Test Results:\nTable Status: ${createResponse.data.message}\nUser Assignments: ${testResponse.data.user_assignments}\nTotal Assignments: ${testResponse.data.total_assignments}\nAvailable Files: ${testResponse.data.available_files}\nAvailable Users: ${testResponse.data.available_users}`);
    } catch (error) {
      console.error('Test error:', error);
      alert('Test failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const testAssignFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Testing file assignment...');
      
      const response = await axios.post(`${config.BASE_URL}/api/test-assign-files`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Assignment response:', response.data);
      
      if (response.data.status === 'success') {
        alert(`Assignment successful!\n${response.data.message}\nFiles assigned: ${response.data.files_assigned.map(f => f.filename).join(', ')}`);
        // Refresh the assigned files list
        fetchAssignedFiles();
      } else {
        alert('Assignment failed: ' + response.data.error);
      }
    } catch (error) {
      console.error('Assignment error:', error);
      alert('Assignment failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const debugAssignments = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Debugging assignments...');
      
      const response = await axios.get(`${config.BASE_URL}/api/debug-assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Debug response:', response.data);
      
      alert(`Debug Results:\nUser ID: ${response.data.user_id}\nUser Assignments: ${response.data.user_assignments_count}\nTotal Assignments: ${response.data.total_assignments}\nUploaded Files: ${response.data.uploaded_files_count}\n\nCheck console for full details.`);
    } catch (error) {
      console.error('Debug error:', error);
      alert('Debug failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const fetchAssignedFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is authenticated
      if (!isAuthenticated()) {
        logout();
        return;
      }
      
      const response = await apiRequest(`${config.BASE_URL}/api/my-assigned-files`);
      const files = response.assigned_files || [];
      setAssignedFiles(files);

      // Show files immediately, then load content in background
      if (files.length > 0) {
        // Initialize with basic file info first
        const reportInfo = {};
        files.forEach(file => {
          reportInfo[file.id] = extractReportInfo(file);
        });
        setReportData(reportInfo);
        
        // Try to load content in background (only for files that might have JSON)
        setContentLoading(true);
        try {
          const token = localStorage.getItem('token');
          // Process files in smaller batches to avoid timeout
          const batchSize = 5;
          
          for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const fileIds = batch.map(file => file.id);
            
            try {
              const batchResponse = await axios.post(`${config.BASE_URL}/api/uploaded-files/batch-content`, fileIds, {
                headers: { 
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                timeout: 20000 // 20 second timeout per batch
              });
              
              if (batchResponse.data.status === 'success') {
                // Process all files from batch response
                batchResponse.data.files.forEach(fileData => {
                  const extracted = extractReportInfoFromContent(fileData.content, fileData.filename);
                  reportInfo[fileData.file_id] = extracted;
                });
              }
            } catch (batchErr) {
              console.warn(`Batch ${Math.floor(i/batchSize) + 1} failed, skipping content loading:`, batchErr);
              // Don't fall back to individual requests, just skip content loading
            }
            
            // Update state progressively to show loading progress
            setReportData(prev => ({ ...prev, ...reportInfo }));
          }
          
        } catch (err) {
          console.error('Error in content fetch, using basic file info:', err);
          // Keep the basic file info we already set
        } finally {
          setContentLoading(false);
        }
      } else {
        setContentLoading(false);
      }
    } catch (err) {
      console.error('Error fetching assigned files:', err);
      setError(`Failed to load assigned files: ${err.response?.data?.detail || err.message}. Please try the Test button to debug.`);
    } finally {
      setLoading(false);
    }
  };

  const extractReportInfoFromContent = (content, filename) => {
    try {
      console.log('=== EXTRACTING REPORT INFO ===');
      console.log('Content structure:', content);
      console.log('Content metadata:', content.metadata);
      
      // Extract from metadata first (new structure)
      const metadata = content.metadata || {};
      const reportSummary = content.Report_Summary || {};
      const unmappedSections = content.Unmapped_Sections || {};
      
      // For observations, try to get from parts if available
      const partIIAObservations = content.Parts && content.Parts["PART II (A)"] && content.Parts["PART II (A)"].Observations || [];
      const partIIBObservations = content.Parts && content.Parts["PART II (B)"] && content.Parts["PART II (B)"].Observations || [];
      const totalObservations = partIIAObservations.length + partIIBObservations.length;

      const formatDate = (dateStr) => {
        if (!dateStr || dateStr === 'N/A') return 'N/A';
        try {
          if (/^\d{4}$/.test(dateStr)) return dateStr;
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/');
            const date = new Date(year, month - 1, day);
            if (isNaN(date.getTime())) return 'N/A';
            return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
          }
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return 'N/A';
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        } catch (e) {
          return 'N/A';
        }
      };

      // Try to find date information recursively
      const findDateRecursively = (obj, dateField) => {
        if (!obj || typeof obj !== 'object') return null;
        
        // Check if this object has the date field
        if (obj[dateField]) return obj[dateField];
        
        // Check common date field variations
        const dateFields = [dateField, 'Period_From', 'Period_To', 'period_from', 'period_to', 'from', 'to'];
        for (const field of dateFields) {
          if (obj[field]) return obj[field];
        }
        
        // Recursively search in nested objects
        for (const key in obj) {
          if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
            const result = findDateRecursively(obj[key], dateField);
            if (result) return result;
          }
        }
        return null;
      };

      // Extract period from metadata (matching BulkUploadViewer logic)
      let periodDisplay = 'N/A';

      // Try Period_of_audit first
      if (metadata.Period_of_audit?.Period_From && metadata.Period_of_audit?.Period_To) {
        periodDisplay = `${metadata.Period_of_audit.Period_From} - ${metadata.Period_of_audit.Period_To}`;
      } else if (metadata.Period_of_audit?.Period_From) {
        periodDisplay = metadata.Period_of_audit.Period_From;
      } else if (metadata.Period_of_audit?.Period_To) {
        periodDisplay = metadata.Period_of_audit.Period_To;
      } else if (metadata.Date_of_audit?.Period_From) {
        // Try to extract year from Date_of_audit
        const dateStr = metadata.Date_of_audit.Period_From;
        const yearMatch = dateStr.match(/(\d{4})/);
        if (yearMatch) {
          periodDisplay = yearMatch[1];
        } else {
          periodDisplay = dateStr;
        }
      } else {
        // Look for year in document heading
        const heading = metadata.document_heading || '';
        const yearMatch = heading.match(/(\d{4})/);
        if (yearMatch) {
          periodDisplay = yearMatch[1];
        } else {
          periodDisplay = 'N/A';
        }
      }



      const result = {
        name: filename.replace('_new_schema.json', '').replace('.json', ''),
        period: periodDisplay,
        departments: (() => {
          // Try metadata first
          if (metadata.departments && metadata.departments !== null) {
            return metadata.departments;
          }
          
          // If departments is null, try to extract from document heading (like BulkUploadViewer)
          if (metadata.document_heading) {
            const heading = metadata.document_heading.toLowerCase();
            if (heading.includes('registry')) {
              return 'Sub Registry';
            } else if (heading.includes('commercial')) {
              return 'Commercial';
            } else if (heading.includes('revenue')) {
              return 'Revenue';
            } else if (heading.includes('accountant general') || heading.includes('audit')) {
              return 'Accountant General';
            } else {
              return 'Uploaded';
            }
          }
          
          // Fallback to old logic
          if (content.Inspection_Period?.departments) return content.Inspection_Period.departments;
          if (content.Inspection_Period?.Departments) return content.Inspection_Period.Departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Inspection_Period?.departments) return content.Parts["PART I"].Inspection_Report.Inspection_Period.departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Inspection_Period?.Departments) return content.Parts["PART I"].Inspection_Report.Inspection_Period.Departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Reporting_Period?.departments) return content.Parts["PART I"].Inspection_Report.Reporting_Period.departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Reporting_Period?.Departments) return content.Parts["PART I"].Inspection_Report.Reporting_Period.Departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Org_Hierarchy?.Hier_Code_Lvl1) return content.Parts["PART I"].Inspection_Report.Org_Hierarchy.Hier_Code_Lvl1;
          
          // Try to find department information anywhere in the content recursively
          const findDepartmentRecursively = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            
            // Check if this object has department-related fields
            const deptFields = ['departments', 'Departments', 'department', 'Department', 'dept', 'Dept'];
            for (const field of deptFields) {
              if (obj[field]) return obj[field];
            }
            
            // Recursively search in nested objects
            for (const key in obj) {
              if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                const result = findDepartmentRecursively(obj[key]);
                if (result) return result;
              }
            }
            return null;
          };
          
          return findDepartmentRecursively(content) || 'Uploaded';
        })(),
        state: (() => {
          // Try metadata first
          if (metadata.state && metadata.state !== null) {
            return metadata.state;
          }
          
          // Fallback to old logic
          if (content.Inspection_Period?.state_name) return content.Inspection_Period.state_name;
          if (content.Inspection_Period?.State_Name) return content.Inspection_Period.State_Name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Inspection_Period?.state_name) return content.Parts["PART I"].Inspection_Report.Inspection_Period.state_name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Inspection_Period?.State_Name) return content.Parts["PART I"].Inspection_Report.Inspection_Period.State_Name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Reporting_Period?.state_name) return content.Parts["PART I"].Inspection_Report.Reporting_Period.state_name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Reporting_Period?.State_Name) return content.Parts["PART I"].Inspection_Report.Reporting_Period.State_Name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Org_Hierarchy?.Hier_Code_Lvl2) return content.Parts["PART I"].Inspection_Report.Org_Hierarchy.Hier_Code_Lvl2;
          
          // Try to find state information anywhere in the content recursively
          const findStateRecursively = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            
            // Check if this object has state-related fields
            const stateFields = ['state_name', 'State_Name', 'state', 'State', 'stateName', 'StateName'];
            for (const field of stateFields) {
              if (obj[field]) return obj[field];
            }
            
            // Recursively search in nested objects
            for (const key in obj) {
              if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                const result = findStateRecursively(obj[key]);
                if (result) return result;
              }
            }
            return null;
          };
          
          return findStateRecursively(content) || 'Tamilnadu';
        })(),
        summary: reportSummary.Key?.Report_Short_Summary || 'No summary available',
        unmappedCount: unmappedSections.Content ? unmappedSections.Content.length : 0,
        totalObservations: totalObservations,
        expenditure: content.Budget_Detail?.Expenditure || 'N/A',
        expenditureUnit: content.Budget_Detail?.Expenditure_Unit || ''
      };
      

      return result;
    } catch (err) {
      console.error('Error extracting report info:', err);
      return extractReportInfo({ filename });
    }
  };

  const extractReportInfo = (file) => {
    return {
      name: file.filename.replace('_new_schema.json', '').replace('.json', ''),
      period: 'N/A',
      departments: 'N/A',
      state: 'N/A',
      summary: 'N/A',
      unmappedCount: 0,
      totalObservations: 0,
      expenditure: 'N/A',
      expenditureUnit: ''
    };
  };

  const getValidationStatusForFile = (file) => {
    // Handle both integer and boolean values for backward compatibility
    if (typeof file?.validated === 'number') {
      return file.validated === 1 ? 'Validated' : 'Non-validated';
    }
    if (typeof file?.validated === 'boolean') {
      return file.validated ? 'Validated' : 'Non-validated';
    }
    const report = reportData[file.id];
    if (!report || typeof report.unmappedCount !== 'number') return 'Unknown';
    return report.unmappedCount === 0 ? 'Validated' : 'Non-validated';
  };

  const getUniqueValues = (field) => {
    const values = new Set();
    assignedFiles.forEach(file => {
      const value = reportData[file.id]?.[field];
      if (value && value !== 'N/A') values.add(value);
    });
    return Array.from(values).sort();
  };

  const filterData = (data) => {
    return data.filter(file => {
      const report = reportData[file.id];
      if (!report) return false;
      const matchesSearch = file.filename.toLowerCase().includes(search.toLowerCase()) ||
                           report.name.toLowerCase().includes(search.toLowerCase());
      const matchesState = !filterState || report.state === filterState;
      const matchesDepartment = !filterDepartment || report.departments === filterDepartment;
      const matchesStatus = !filterStatus || getValidationStatusForFile(file) === filterStatus;
      return matchesSearch && matchesState && matchesDepartment && matchesStatus;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setFilterState('');
    setFilterDepartment('');
    setFilterStatus('');
    setCurrentPage(1);
  };

  // Count active filters (excluding search since it's separate)
  const getActiveFilterCount = () => {
    let count = 0;
    if (filterState) count++;
    if (filterDepartment) count++;
    if (filterStatus) count++;
    return count;
  };

  const handleViewDetails = (fileId, filename) => {
    // Navigate directly to FileViewer page
    navigate('/file-viewer', {
      state: { fileId, filename }
    });
  };

  const handleUpdateData = async (fileId, filename) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Load data in background
      const [jsonRes, docxMetaRes] = await Promise.allSettled([
        axios.get(`${config.BASE_URL}/api/uploaded-files/${fileId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000 // 15 second timeout
        }),
        axios.get(`${config.BASE_URL}/api/uploaded-files/${fileId}/related-docx`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000 // 10 second timeout
        })
      ]);

      let jsonData = null;
      let dataSource = 'original';
      if (jsonRes.status === 'fulfilled') {
        if (jsonRes.value.data.status === 'success') {
          jsonData = jsonRes.value.data.content;
          dataSource = jsonRes.value.data.source || 'original';
        } else {
          throw new Error('Failed to load file content: ' + (jsonRes.value.data.message || 'Unknown error'));
        }
      } else {
        throw new Error('Failed to load file content: ' + (jsonRes.reason?.message || 'Network error'));
      }

      let docxInfo = null;
      let docxId = null;
      if (docxMetaRes.status === 'fulfilled' && docxMetaRes.value.status === 200) {
        docxInfo = docxMetaRes.value.data;
        docxId = docxInfo.id;
        console.log('Related DOCX API success:', docxInfo);
      } else {
        console.log('Related DOCX API failed:', docxMetaRes);
      }

      let docxArrayBuffer = null;
      if (docxId) {
        try {
          console.log(`Downloading DOCX file with ID: ${docxId}`);
          const docxDownloadRes = await axios.get(`${config.BASE_URL}/api/download/${docxId}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'arraybuffer',
            timeout: 30000 // 30 second timeout for file download
          });
          console.log('DOCX download response status:', docxDownloadRes.status);
          if (docxDownloadRes.status === 200) {
            docxArrayBuffer = docxDownloadRes.data;
            console.log('DOCX download successful, size:', docxArrayBuffer.byteLength);
          }
        } catch (downloadErr) {
          console.warn('Failed to download DOCX file, continuing without it:', downloadErr);
          // Continue without DOCX file - it's not critical for validation
        }
      } else {
        console.log('No docxId available, skipping DOCX download');
      }
        
      if (!docxInfo || !docxInfo.id) {
        docxInfo = { ...(docxInfo || {}), id: docxId };
      }

      // Navigate directly to data validation with loaded data
      console.log('=== AssignedDocuments - Navigating to DataValidation ===');
      console.log('jsonData:', jsonData);
      console.log('fileName:', filename);
      console.log('docxInfo:', docxInfo);
      console.log('docxArrayBuffer:', docxArrayBuffer);
      console.log('docxArrayBuffer type:', typeof docxArrayBuffer);
      console.log('docxArrayBuffer size:', docxArrayBuffer ? docxArrayBuffer.byteLength : 'N/A');
      console.log('fileId:', fileId);
      console.log('dataSource:', dataSource);
      
      navigate('/data-validation', {
        state: {
          jsonData,
          fileName: filename,
          docxInfo,
          docxArrayBuffer,
          fileId,
          isLoading: false,
          source: dataSource
        }
      });

    } catch (err) {
      console.error('Error loading file content:', err);
      
      // Show user-friendly error message
      const errorMessage = err.message || 'Unknown error occurred';
      alert(`Error loading file content: ${errorMessage}\n\nPlease try again or contact support if the problem persists.`);
      
      // Navigate back to the assigned documents page
      navigate('/assigned-documents');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getFileTypeIcon = (fileType) => {
    if (fileType?.includes('json')) return '📄';
    if (fileType?.includes('docx')) return '📝';
    if (fileType?.includes('pdf')) return '📕';
    if (fileType?.includes('image')) return '🖼️';
    return '📁';
  };

  const getFileTypeBadge = (fileType) => {
    if (fileType?.includes('json')) return 'primary';
    if (fileType?.includes('docx')) return 'success';
    if (fileType?.includes('pdf')) return 'danger';
    if (fileType?.includes('image')) return 'info';
    return 'secondary';
  };

  const filteredFiles = filterData(assignedFiles);
  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  
  if (loading && !assignedFiles.length) {
    return (
      <div className="container-fluid py-4">
        <h2 className="dashboard-heading">My Assigned Documents</h2>
        <Card className="shadow-sm table-card">
          <Card.Header className="bg-white">
            <h5 className="mb-0 table-heading">All Documents</h5>
          </Card.Header>
          <Card.Body className="text-center py-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="mt-3">Loading assigned files...</p>
            {contentLoading && (
              <div className="mt-3">
                <small className="text-muted">Processing file contents...</small>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* User Profile Section */}
      {currentUser && (
        <Card className="shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Card.Body className="py-3">
            <Row className="align-items-center">
              <Col md={8}>
                <div className="d-flex align-items-center">
                  <div 
                    className="rounded-circle me-3 d-flex align-items-center justify-content-center"
                    style={{ 
                      width: '60px', 
                      height: '60px', 
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      border: '2px solid rgba(255,255,255,0.3)'
                    }}
                  >
                    <i className="fas fa-user" style={{ fontSize: '24px' }} />
                  </div>
                  <div>
                    <h4 className="mb-1 fw-bold">
                      Welcome, {currentUser.firstname} {currentUser.lastname}
                    </h4>
                    <p className="mb-1 opacity-75">
                      <i className="fas fa-envelope me-2"></i>
                      {currentUser.email}
                    </p>
                    <p className="mb-0 opacity-75">
                      <i className="fas fa-id-badge me-2"></i>
                      User ID: {currentUser.id} | Role: {currentUser.role?.charAt(0).toUpperCase() + currentUser.role?.slice(1) || 'User'}
                    </p>
                  </div>
                </div>
              </Col>
              <Col md={4} className="text-end">
                <div className="text-end">
                  <div className="h5 mb-1">{assignedFiles.length}</div>
                  <div className="opacity-75">Assigned Documents</div>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* Greeting */}
      <h2 className="dashboard-heading">My Assigned Documents</h2>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

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
                        {getUniqueValues('departments').map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </FormControl>
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Filter by Status</label>
                      <FormControl
                        as="select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="form-select"
                      >
                        <option value="">All Status</option>
                        <option value="Validated">Validated</option>
                        <option value="Non-validated">Non-validated</option>
                      </FormControl>
                    </div>
                    
                    <div className="d-flex gap-2">
                      <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => {}} // Filter is applied automatically
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
                    Showing {filteredFiles.length} of {assignedFiles.length} documents
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
                  {filterStatus && (
                    <Badge bg="secondary" className="ms-1">
                      Status: {filterStatus}
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
                  <th>Period</th>
                  <th>Department</th>
                  <th>State</th>
                  <th>Status</th>
                  <th>Assigned On</th>
                  <th>Assigned By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4 text-muted">
                      <i className="fas fa-inbox fa-2x mb-2 d-block"></i>
                      {assignedFiles.length === 0 ? 'No documents assigned yet' : 'No files match your search'}
                    </td>
                  </tr>
                ) : (
                  paginatedFiles.map((file, index) => {
                    const reportInfo = reportData[file.id];
                    
                    return (
                    <tr key={file.id}>
                      <td className="text-center fw-medium text-muted">
                        {startIndex + index + 1}
                      </td>
                      <td className="fw-medium">{reportInfo?.name || file.filename}</td>
                      <td>{reportInfo?.period || 'N/A'}</td>
                      <td>{reportInfo?.departments || 'N/A'}</td>
                      <td>{reportInfo?.state || 'N/A'}</td>
                      <td className="badge-style">
                        {getValidationStatusForFile(file) === 'Validated' ? (
                          <Badge bg="success">Validated</Badge>
                        ) : (
                          <Badge bg="warning" text="dark">Non-validated</Badge>
                        )}
                      </td>
                      <td>
                        <span className="text-muted">{formatDate(file.assigned_at)}</span>
                      </td>
                      <td className='badge-style'>
                        <Badge bg="secondary">{file.assigned_by_name || 'Unknown Admin'}</Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleViewDetails(file.id, file.filename)}
                          >
                            <i className="fas fa-eye me-1"></i>
                            View
                          </Button>
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={() => handleUpdateData(file.id, file.filename)}
                          >
                            <i className="fas fa-check me-1"></i>
                            Validate
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
        <Card.Footer className="bg-light">
          {totalPages > 0 && (
            <div className="d-flex justify-content-center align-items-center">
              <div className='me-4'>
                <span className="text-muted">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredFiles.length)} of {filteredFiles.length} files
                </span>
              </div>
              {totalPages > 1 && (
                <Pagination>
                  <Pagination.First
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  />
                  <Pagination.Prev
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  />
                  {[...Array(totalPages).keys()].map(page => (
                    <Pagination.Item
                      key={page + 1}
                      active={page + 1 === currentPage}
                      onClick={() => handlePageChange(page + 1)}
                    >
                      {page + 1}
                    </Pagination.Item>
                  ))}
                  <Pagination.Next
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  />
                  <Pagination.Last
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  />
                </Pagination>
              )}
            </div>
          )}
        </Card.Footer>
      </Card>
    </div>
  );
};

export default AssignedDocuments;