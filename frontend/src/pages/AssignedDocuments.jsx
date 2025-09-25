import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Alert, Spinner, Row, Col, FormControl, InputGroup, Table, Badge, Pagination } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config.js';

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
  const [validatingFileId, setValidatingFileId] = useState(null); // Track which file is being validated
  const itemsPerPage = 10;

  useEffect(() => {
    fetchAssignedFiles();
  }, []);

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
      const token = localStorage.getItem('token');
      const response = await axios.get(`${config.BASE_URL}/api/my-assigned-files`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000 // 15 second timeout for initial request
      });
      const files = response.data.assigned_files || [];
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
                  console.log('=== ASSIGNED DOCS DEBUG ===');
                  console.log('File:', fileData.filename);
                  console.log('Content keys:', Object.keys(fileData.content || {}));
                  console.log('Inspection_Period:', fileData.content?.Inspection_Period);
                  console.log('Reporting_Period:', fileData.content?.Reporting_Period);
                  console.log('Parts:', fileData.content?.Parts);
                  const extracted = extractReportInfoFromContent(fileData.content, fileData.filename);
                  console.log('Extracted period:', extracted.period);
                  console.log('=== END DEBUG ===');
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

      
      let report = content;
      if (content.Parts && content.Parts["PART I"] && content.Parts["PART I"].Inspection_Report) {
        report = content.Parts["PART I"].Inspection_Report;
      }
      const reportingPeriod = report.Reporting_Period || {};
      const inspectionPeriod = report.Inspection_Period || {};
      const reportSummary = content.Report_Summary || {};
      const unmappedSections = content.Unmapped_Sections || {};
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

      let periodFromFormatted = formatDate(reportingPeriod.Period_From);
      let periodToFormatted = formatDate(reportingPeriod.Period_To);
      
      if (periodFromFormatted === 'N/A' || periodToFormatted === 'N/A') {
        periodFromFormatted = formatDate(inspectionPeriod.Period_From);
        periodToFormatted = formatDate(inspectionPeriod.Period_To);
      }
      
      // Try the direct path from the console output
      if (periodFromFormatted === 'N/A' || periodToFormatted === 'N/A') {
        periodFromFormatted = formatDate(content.Inspection_Period?.Period_From);
        periodToFormatted = formatDate(content.Inspection_Period?.Period_To);
      }
      
      // Try recursive search if still not found
      if (periodFromFormatted === 'N/A') {
        const foundFrom = findDateRecursively(content, 'Period_From');
        if (foundFrom) periodFromFormatted = formatDate(foundFrom);
      }
      
      if (periodToFormatted === 'N/A') {
        const foundTo = findDateRecursively(content, 'Period_To');
        if (foundTo) periodToFormatted = formatDate(foundTo);
      }
      
      const periodDisplay = periodFromFormatted !== 'N/A' && periodToFormatted !== 'N/A'
        ? `${periodFromFormatted} - ${periodToFormatted}`
        : (periodFromFormatted !== 'N/A' ? periodFromFormatted : 'N/A');



      const result = {
        name: filename.replace('_new_schema.json', '').replace('.json', ''),
        period: periodDisplay,
        departments: (() => {
          // Try multiple possible locations for department information
          if (content.Inspection_Period?.departments) return content.Inspection_Period.departments;
          if (content.Inspection_Period?.Departments) return content.Inspection_Period.Departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Inspection_Period?.departments) return content.Parts["PART I"].Inspection_Report.Inspection_Period.departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Inspection_Period?.Departments) return content.Parts["PART I"].Inspection_Report.Inspection_Period.Departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Reporting_Period?.departments) return content.Parts["PART I"].Inspection_Report.Reporting_Period.departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Reporting_Period?.Departments) return content.Parts["PART I"].Inspection_Report.Reporting_Period.Departments;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Org_Hierarchy?.Hier_Code_Lvl1) return content.Parts["PART I"].Inspection_Report.Org_Hierarchy.Hier_Code_Lvl1;
          if (reportingPeriod.departments) return reportingPeriod.departments;
          if (inspectionPeriod.departments) return inspectionPeriod.departments;
          
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
          
          return findDepartmentRecursively(content) || 'N/A';
        })(),
        state: (() => {
          // Try multiple possible locations for state information
          if (content.Inspection_Period?.state_name) return content.Inspection_Period.state_name;
          if (content.Inspection_Period?.State_Name) return content.Inspection_Period.State_Name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Inspection_Period?.state_name) return content.Parts["PART I"].Inspection_Report.Inspection_Period.state_name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Inspection_Period?.State_Name) return content.Parts["PART I"].Inspection_Report.Inspection_Period.State_Name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Reporting_Period?.state_name) return content.Parts["PART I"].Inspection_Report.Reporting_Period.state_name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Reporting_Period?.State_Name) return content.Parts["PART I"].Inspection_Report.Reporting_Period.State_Name;
          if (content.Parts?.["PART I"]?.Inspection_Report?.Org_Hierarchy?.Hier_Code_Lvl2) return content.Parts["PART I"].Inspection_Report.Org_Hierarchy.Hier_Code_Lvl2;
          if (reportingPeriod.state_name) return reportingPeriod.state_name;
          if (inspectionPeriod.state_name) return inspectionPeriod.state_name;
          
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
          
          return findStateRecursively(content) || 'N/A';
        })(),
        summary: reportSummary.Key?.Report_Short_Summary || 'No summary available',
        unmappedCount: unmappedSections.Content ? unmappedSections.Content.length : 0,
        totalObservations: totalObservations,
        expenditure: report.Budget_Detail?.Expenditure || 'N/A',
        expenditureUnit: report.Budget_Detail?.Expenditure_Unit || ''
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

  const handleViewDetails = async (fileId, filename) => {
    try {
      const token = localStorage.getItem('token');
      console.log(`Loading content for file ID: ${fileId}, filename: ${filename}`);
      
      const response = await axios.get(`${config.BASE_URL}/api/uploaded-files/${fileId}/content`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('API Response:', response.data);
      
      if (response.data.status === 'success') {
        const jsonData = response.data.content;
        const dataSource = response.data.source || 'original';
        console.log('JSON Data structure:', {
          hasContent: !!jsonData,
          contentType: typeof jsonData,
          keys: jsonData ? Object.keys(jsonData) : 'No keys',
          hasInspectionReport: !!(jsonData && jsonData.Inspection_Report),
          hasParts: !!(jsonData && jsonData.Parts),
          dataSource: dataSource
        });
        
        navigate(`/report-details/${encodeURIComponent(filename)}`, {
          state: { jsonData: jsonData, source: dataSource }
        });
      } else {
        console.error('API returned error status:', response.data);
        alert('Failed to load file content: ' + (response.data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error loading file content:', err);
      alert('Error loading file content: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateData = async (fileId, filename) => {
    try {
      setValidatingFileId(fileId); // Start loading for the specific file
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Navigate immediately with loading state
      navigate('/data-validation', {
        state: {
          fileId,
          fileName: filename,
          isLoading: true // Flag to show loading state
        }
      });

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
      }

      let docxArrayBuffer = null;
      if (docxId) {
        try {
          const docxDownloadRes = await axios.get(`${config.BASE_URL}/api/download/${docxId}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'arraybuffer',
            timeout: 30000 // 30 second timeout for file download
          });
          if (docxDownloadRes.status === 200) {
            docxArrayBuffer = docxDownloadRes.data;
          }
        } catch (downloadErr) {
          console.warn('Failed to download DOCX file, continuing without it:', downloadErr);
          // Continue without DOCX file - it's not critical for validation
        }
        
        if (!docxInfo || !docxInfo.id) {
          docxInfo = { ...(docxInfo || {}), id: docxId };
        }
      }

      // Navigate again with the loaded data
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
    } finally {
      setValidatingFileId(null); // End loading for the specific file
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
      <Container fluid className="py-4">
        <Card className="shadow-sm">
          <Card.Header className="bg-primary text-white text-center">
            <h5 className="mb-0">
              <i className="fas fa-file-alt me-2"></i>
              My Assigned Documents
            </h5>
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
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 assigned-head" style={{ marginTop: "6rem" }}>
      <Card className="shadow-sm">
        <Card.Header className="bg-primary text-white text-center">
          <h5 className="mb-0">
            <i className="fas fa-file-alt me-2"></i>
            My Assigned Documents
          </h5>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
          <Row className="mb-3 g-3 align-items-end">
            <Col xs={12} md={4}>
              <InputGroup>
                <InputGroup.Text><i className="fas fa-search"></i></InputGroup.Text>
                <FormControl
                  placeholder="Search file name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search file name"
                />
              </InputGroup>
            </Col>
            <Col xs={6} md={2}>
              <FormControl
                as="select"
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
                className="form-select"
                aria-label="Filter by state"
              >
                <option value="">All States</option>
                {getUniqueValues('state').map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </FormControl>
            </Col>
            <Col xs={6} md={2}>
              <FormControl
                as="select"
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="form-select"
                aria-label="Filter by department"
              >
                <option value="">All Departments</option>
                {getUniqueValues('departments').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </FormControl>
            </Col>
            <Col xs={6} md={2}>
              <FormControl
                as="select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-select"
                aria-label="Filter by status"
              >
                <option value="">All Status</option>
                <option value="Validated">Validated</option>
                <option value="Non-validated">Non-validated</option>
              </FormControl>
            </Col>
            <Col xs={6} md={2}>
              <Button
                variant="outline-danger"
                onClick={clearFilters}
                className="w-50"
                title="Clear filters"
              >
                <i className="fas fa-times me-1"></i>
                Clear
              </Button>
            </Col>
          </Row>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-5">
              <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
              <h5 className="text-muted">
                {assignedFiles.length === 0 ? 'No documents assigned yet' : 'No files match your search'}
              </h5>
              <p className="text-muted">
                Documents assigned to you by administrators will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <span className="badge bg-info fs-6">
                    Total: {filteredFiles.length} document{filteredFiles.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Button variant="outline-primary" onClick={fetchAssignedFiles} style={{ width: '120px' }}>
                  <i className="fas fa-sync-alt me-2"></i>
                  Refresh
                </Button>
            <Button variant="outline-warning" onClick={testAssignedFiles} style={{ width: '120px', marginLeft: '10px' }}>
              <i className="fas fa-bug me-2"></i>
              Test
            </Button>
            <Button variant="outline-success" onClick={testAssignFiles} style={{ width: '140px', marginLeft: '10px' }}>
              <i className="fas fa-plus me-2"></i>
              Assign Test Files
            </Button>
            <Button variant="outline-info" onClick={debugAssignments} style={{ width: '120px', marginLeft: '10px' }}>
              <i className="fas fa-search me-2"></i>
              Debug
            </Button>
              </div>
              {contentLoading && (
                <div className="mb-3">
                  <div className="d-flex align-items-center">
                    <Spinner animation="border" size="sm" className="me-2" />
                    <span className="text-muted">Loading file contents...</span>
                  </div>
                </div>
              )}
              <div className="table-responsive custom-height">
                <Table striped bordered hover className="align-middle" style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', minWidth: 760 }}>
                  <thead className="table-light">
                    <tr style={{ fontWeight: 600, fontSize: 16 }}>
                      <th>Name</th>
                      <th>Period</th>
                      <th>Department</th>
                      <th>State</th>
                      <th>Status</th>
                      <th>Assigned On</th>
                      <th>Assigned By</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFiles.map((file) => (
                      <tr key={file.id} style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = '#e3f2fd'}
                          onMouseOut={e => e.currentTarget.style.background = ''}
                        >
                        <td style={{ fontWeight: 500 }}>{reportData[file.id]?.name || file.filename}</td>
                        <td>{reportData[file.id]?.period || 'N/A'}</td>
                        <td>{reportData[file.id]?.departments || 'N/A'}</td>
                        <td>{reportData[file.id]?.state || 'N/A'}</td>
                        <td>
                          {getValidationStatusForFile(file) === 'Validated' ? (
                            <Badge bg="success">Validated</Badge>
                          ) : (
                            <Badge bg="warning" text="dark">Non-validated</Badge>
                          )}
                        </td>
                        <td>
                          <span className="text-muted">{formatDate(file.assigned_at)}</span>
                        </td>
                        <td>
                          <Badge bg="secondary">{file.assigned_by_name}</Badge>
                        </td>
                        <td className="text-center">
                          <div className="d-flex gap-2 justify-content-center">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleViewDetails(file.id, file.filename)}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline-success"
                              size="sm"
                              onClick={() => handleUpdateData(file.id, file.filename)}
                              disabled={validatingFileId === file.id}
                            >
                              {validatingFileId === file.id ? (
                                <Spinner animation="border" size="sm" />
                              ) : (
                                'Validate'
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {totalPages > 0 && (
                <div className="d-flex justify-content-center align-items-center mt-4">
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
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AssignedDocuments;