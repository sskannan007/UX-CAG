import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaFileUpload, FaDownload, FaTrash } from 'react-icons/fa';
import { MdCloudUpload, MdCheckCircle } from 'react-icons/md';
import { Container, Row, Col, Button, Alert, Table, Spinner, Card, ProgressBar, Modal } from 'react-bootstrap';
import config from '../config.js';
import '../styles/dashboard.scss';

const BulkUploadUsers = () => {
  const navigate = useNavigate();
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewData, setPreviewData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [filesUploading, setFilesUploading] = useState(false);

  // Handle file selection
  const handleFileSelect = (file) => {
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || 
                 file.type === 'application/vnd.ms-excel' || 
                 file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                 file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
      setUploadError('');
      previewFile(file);
    } else {
      setUploadError('Please select a valid CSV or Excel file (.csv, .xlsx, .xls)');
      setSelectedFile(null);
      setShowPreview(false);
    }
  };

  // Preview file content (mock implementation)
  const previewFile = async (file) => {
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',');
      
      const mockData = [];
      for (let i = 1; i < Math.min(lines.length, 11); i++) { // Show first 10 rows
        if (lines[i].trim()) {
          const values = lines[i].split(',');
          const row = {};
          headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim().replace(/"/g, '') : '';
          });
          mockData.push({
            ...row,
            id: i,
            status: 'Ready'
          });
        }
      }
      setPreviewData(mockData);
      setShowPreview(true);
    } catch (error) {
      console.error('Error previewing file:', error);
      setUploadError('Error previewing file content');
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle bulk upload submission
  const handleBulkUploadSubmit = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file first');
      return;
    }

    setUploadLoading(true);
    setFilesUploading(true);
    setUploadError('');
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const token = localStorage.getItem('token');
      const response = await fetch(`${config.BASE_URL}/admin/users/bulk-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to upload users');
      }

      const result = await response.json();
      setUploadProgress(100);
      setUploadResult(result);
      
      // Update preview data to show success
      setPreviewData(prev => prev.map(user => ({
        ...user,
        status: 'Success'
      })));
      
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 500);
      
    } catch (err) {
      console.error('Bulk upload error:', err);
      setUploadError(`Failed to upload users: ${err.message}`);
      setUploadProgress(0);
      
      // Update preview data to show error
      setPreviewData(prev => prev.map(user => ({
        ...user,
        status: 'Error'
      })));
    } finally {
      setUploadLoading(false);
      clearInterval(progressInterval);
    }
  };

  // Generate sample CSV
  const downloadSampleCSV = () => {
    const sampleData = [
      ['firstname', 'lastname', 'email', 'contactno', 'dob', 'place', 'city', 'state', 'pincode', 'gender', 'password'],
    ];

    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCancel = () => {
    navigate('/user-management');
  };

  const handleGoToDashboard = () => {
    navigate('/user-management', { 
      state: { 
        message: `Successfully uploaded ${uploadResult?.successful_users || 0} users${uploadResult?.failed_users > 0 ? `. ${uploadResult.failed_users} users failed to upload.` : ''}` 
      } 
    });
  };

  const clearFile = () => {
    setSelectedFile(null);
    setShowPreview(false);
    setPreviewData([]);
    setUploadProgress(0);
    setFilesUploading(false);
  };

  return (
    <Container fluid className="py-4 bulk-upload-page">
      <Row>
        <Col>
          {/* Breadcrumb */}
          <nav aria-label="breadcrumb" className="mb-3">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <span onClick={() => navigate('/dashboard')}>
                  Home
                </span>
              </li>
              <li className="breadcrumb-item">
                <span onClick={() => navigate('/user-management')}>
                  Settings & Configurations
                </span>
              </li>
              <li className="breadcrumb-item">
                <span onClick={() => navigate('/user-management')}>
                  Bulk Users
                </span>
              </li>
              <li className="breadcrumb-item active" aria-current="page">Add bulk users</li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="dashboard-heading mb-0">Bulk Upload users</h2>
            <Button 
              variant="primary" 
              onClick={downloadSampleCSV}
              className="d-flex align-items-center gap-2"
            >
              <FaDownload />
              Download Template
            </Button>
          </div>

          {/* Error Alert */}
          {uploadError && (
            <Alert variant="danger" className="mb-4">
              {uploadError}
            </Alert>
          )}

          <Row>
            <Col>
              {/* File Upload Area - Full Width */}
              <div 
                className={`drag-drop-area ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''} mb-4`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: '2px dashed #ddd',
                  borderRadius: '8px',
                  padding: '60px 20px',
                  textAlign: 'center',
                  backgroundColor: isDragging ? '#f8f9fa' : selectedFile ? '#e8f5e9' : '#fafafa',
                  borderColor: isDragging ? '#007bff' : selectedFile ? '#28a745' : '#ddd',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => !selectedFile && document.getElementById('bulk-file-input').click()}
              >
                <input
                  id="bulk-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                
                {selectedFile ? (
                  <div>
                    <MdCheckCircle size={48} color="#28a745" className="mb-3" />
                    <h5 className="text-success mb-2">File Selected</h5>
                    <p className="mb-1 fw-medium">{selectedFile.name}</p>
                    <small className="text-muted">
                      Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </small>
                    <div className="mt-3">
                      <Button 
                        variant="outline-danger" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); clearFile(); }}
                        className="me-2"
                      >
                        <FaTrash className="me-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <MdCloudUpload size={48} color="#6c757d" className="mb-3" />
                    <h5>Drag files here</h5>
                    <p className="text-muted mb-2">or <span style={{ color: '#007bff', textDecoration: 'underline' }}>browse your computer</span></p>
                  </div>
                )}
              </div>
            </Col>
          </Row>

          {/* File Upload Progress */}
          {(filesUploading || uploadProgress > 0) && (
            <Row className="mb-4">
              <Col lg={6}>
                <Card className="upload-card">
                  <Card.Body className="files-uploading-section">
                    <h6 className="mb-3">Files uploading</h6>
                    <div className="file-item">
                      <div className="file-icon">
                        📊
                      </div>
                      <div className="file-info">
                        <div className="file-name">{selectedFile?.name}</div>
                      </div>
                      <div className="file-actions">
                        <span className="progress-text">{uploadProgress}%</span>
                        {uploadProgress === 100 && !uploadLoading && (
                          <FaTrash className="delete-icon" onClick={clearFile} />
                        )}
                      </div>
                    </div>
                    <ProgressBar 
                      now={uploadProgress} 
                      variant={uploadProgress === 100 ? "success" : "primary"}
                      className="mb-2"
                    />
                    <div className="d-flex justify-content-between">
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={handleCancel}
                        disabled={uploadLoading}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={handleBulkUploadSubmit}
                        disabled={!selectedFile || uploadLoading}
                      >
                        {uploadLoading ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Import
                          </>
                        ) : (
                          'Import'
                        )}
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Preview Table */}
          {showPreview && (
            <Card className="preview-table">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">Preview Data ({previewData.length} users)</h6>
                  <div>
                    <Button 
                      variant="outline-secondary" 
                      size="sm" 
                      className="me-2"
                      onClick={handleCancel}
                      disabled={uploadLoading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={handleBulkUploadSubmit}
                      disabled={uploadLoading}
                    >
                      Add Bulk Users
                    </Button>
                  </div>
                </div>
                
                <div className="table-responsive">
                  <Table striped bordered hover size="sm">
                    <thead className="table-light">
                      <tr>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Email</th>
                        <th>Phone Number</th>
                        <th>Location</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((user, index) => (
                        <tr key={index}>
                          <td>{user.firstname || 'N/A'}</td>
                          <td>{user.lastname || 'N/A'}</td>
                          <td>{user.email || 'N/A'}</td>
                          <td>{user.contactno || 'N/A'}</td>
                          <td>{user.city || user.place || user.state || 'N/A'}</td>
                          <td>{new Date().toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* Success Modal - Popup */}
      <Modal 
        show={showSuccessModal} 
        onHide={() => setShowSuccessModal(false)} 
        centered 
        className="success-modal"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Body className="text-center py-4">
          <MdCheckCircle size={64} color="#28a745" className="mb-3" />
          <h4 className="mb-3">{uploadResult?.successful_users || 0} Users Successfully added</h4>
          {uploadResult?.failed_users > 0 && (
            <p className="text-muted mb-3">
              {uploadResult.failed_users} users failed to upload
            </p>
          )}
          <Button variant="primary" onClick={handleGoToDashboard}>
            Go to dashboard
          </Button>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default BulkUploadUsers;