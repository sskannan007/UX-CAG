import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Spinner, Alert, Row, Col, Badge, Accordion, Tabs, Tab } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import config from '../config.js';

const FileViewer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); //to shw some error

  useEffect(() => {
    const { fileId, filename } = location.state || {};
    
    if (!fileId || !filename) {
      setError('No file data provided');
      setLoading(false);
      return;
    }

    fetchFileData(fileId);
  }, [location.state]);

  const fetchFileData = async (fileId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${config.BASE_URL}/api/uploaded-files/${fileId}/content`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setFileData(data.content);
        } else {
          setError('Failed to load file content: ' + (data.message || 'Unknown error'));
        }
      } else {
        setError('Failed to load file content');
      }
    } catch (err) {
      console.error('Error loading file content:', err);
      setError('Error loading file content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  };

  const getFieldIcon = (fieldName) => {
    const iconMap = {
      'document_name': 'fas fa-file-alt',
      'document_title': 'fas fa-heading',
      'document_heading': 'fas fa-heading',
      'report_title': 'fas fa-chart-line',
      'reporting_period': 'fas fa-calendar-alt',
      'inspection_officer': 'fas fa-user-tie',
      'departments_inspected': 'fas fa-building',
      'state': 'fas fa-map-marker-alt',
      'district': 'fas fa-map-pin',
      'division_name': 'fas fa-sitemap',
      'audit_objective': 'fas fa-bullseye',
      'audit_criteria': 'fas fa-list-check',
      'Period_of_audit': 'fas fa-calendar-check',
      'Date_of_audit': 'fas fa-calendar-day',
      'departments': 'fas fa-building',
      'expenditure': 'fas fa-money-bill-wave',
      'revenue': 'fas fa-chart-pie'
    };
    return iconMap[fieldName] || 'fas fa-info-circle';
  };

  const renderMetadata = (metadata) => {
    if (!metadata) return null;

    const importantFields = [
      'document_name', 'document_title', 'document_heading', 'report_title',
      'reporting_period', 'inspection_officer', 'departments_inspected',
      'state', 'district', 'division_name', 'audit_objective', 'audit_criteria',
      'Period_of_audit', 'Date_of_audit', 'departments', 'expenditure', 'revenue'
    ];

    return (
      <div className="metadata-section">
        <div className="section-header">
          <div className="section-icon">
            <i className="fas fa-info-circle"></i>
          </div>
          <div className="section-title">
            <h4>Document Information</h4>
            <p>Key details and metadata about this document</p>
          </div>
        </div>
        
        <div className="metadata-grid">
          {importantFields.map(field => {
            const value = metadata[field];
            if (!value) return null;
            
            return (
              <div key={field} className="metadata-item">
                <div className="metadata-icon">
                  <i className={getFieldIcon(field)}></i>
                </div>
                <div className="metadata-content">
                  <label className="metadata-label">
                    {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                  <div className="metadata-value">
                    {formatValue(value)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderParts = (parts) => {
    if (!parts || !Array.isArray(parts)) return null;

    return (
      <div className="content-section">
        <div className="section-header">
          <div className="section-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="section-title">
            <h4>Document Content</h4>
            <p>Structured sections and detailed content of the document</p>
          </div>
        </div>
        
        <Accordion defaultActiveKey="0" className="content-accordion">
          {parts.map((part, partIndex) => (
            <Accordion.Item key={partIndex} eventKey={partIndex.toString()} className="part-accordion-item">
              <Accordion.Header className="part-header">
                <div className="part-header-content">
                  <div className="part-number">{partIndex + 1}</div>
                  <div className="part-title">
                    <h5>{part.part_title || 'Untitled Part'}</h5>
                    <p className="part-subtitle">
                      {part.sections ? `${part.sections.length} sections` : 'No sections'}
                    </p>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="part-body">
                {part.sections && part.sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="section-item">
                    <div className="section-header-small">
                      <h6 className="section-title">
                        <i className="fas fa-list me-2"></i>
                        Section {sectionIndex + 1}: {section.section_title || 'Untitled Section'}
                      </h6>
                    </div>
                    
                    <div className="section-content">
                      {section.content && section.content.map((contentItem, contentIndex) => (
                        <div key={contentIndex} className="content-block">
                          {contentItem.type === 'paragraph' && (
                            <div className="paragraph-block">
                              <p>{contentItem.text}</p>
                            </div>
                          )}
                          {contentItem.type === 'table' && (
                            <div className="table-block">
                              <div 
                                className="table-responsive"
                                dangerouslySetInnerHTML={{ __html: contentItem.table }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {section.sub_sections && section.sub_sections.map((subSection, subIndex) => (
                        <div key={subIndex} className="subsection-item">
                          <div className="subsection-header">
                            <h6 className="subsection-title">
                              <i className="fas fa-list-ul me-2"></i>
                              Subsection {subIndex + 1}: {subSection.sub_section_title || 'Untitled Subsection'}
                            </h6>
                          </div>
                          
                          <div className="subsection-content">
                            {subSection.content && subSection.content.map((contentItem, contentIndex) => (
                              <div key={contentIndex} className="content-block">
                                {contentItem.type === 'paragraph' && (
                                  <div className="paragraph-block">
                                    <p>{contentItem.text}</p>
                                  </div>
                                )}
                                {contentItem.type === 'table' && (
                                  <div className="table-block">
                                    <div 
                                      className="table-responsive"
                                      dangerouslySetInnerHTML={{ __html: contentItem.table }}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      </div>
    );
  };

  const renderObservations = (content) => {
    const observations = [];
    
    // Try to find observations in different parts
    if (content.parts) {
      content.parts.forEach(part => {
        if (part.sections) {
          part.sections.forEach(section => {
            if (section.content) {
              section.content.forEach(item => {
                if (item.text && item.text.toLowerCase().includes('observation')) {
                  observations.push(item.text);
                }
              });
            }
          });
        }
      });
    }

    if (observations.length === 0) return null;

    return (
      <div className="observations-section">
        <div className="section-header">
          <div className="section-icon">
            <i className="fas fa-eye"></i>
          </div>
          <div className="section-title">
            <h4>Key Observations</h4>
            <p>Important findings and observations from the document</p>
          </div>
        </div>
        
        <div className="observations-grid">
          {observations.map((observation, index) => (
            <div key={index} className="observation-card">
              <div className="observation-number">{index + 1}</div>
              <div className="observation-content">
                <p>{observation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ marginTop: '85px', minHeight: 'calc(100vh - 85px)' }}>
        <TopNavbar />
        <Container fluid className="py-4">
          <Card className="shadow-sm">
            <Card.Body className="text-center py-5">
              <Spinner animation="border" role="status" size="lg">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <h5 className="mt-3">Loading document...</h5>
              <p className="text-muted">Please wait while we load the file content.</p>
            </Card.Body>
          </Card>
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: '85px', minHeight: 'calc(100vh - 85px)' }}>
        <TopNavbar />
        <Container fluid className="py-4">
          <Alert variant="danger">
            <Alert.Heading>Error Loading Document</Alert.Heading>
            <p>{error}</p>
            <hr />
            <div className="d-flex justify-content-end">
              <Button variant="outline-danger" onClick={() => navigate('/assigned-documents')}>
                Back to Assigned Documents
              </Button>
            </div>
          </Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="file-viewer-container">
      <TopNavbar />
      
      <div className="viewer-content">
        {/* Header */}
        <div className="viewer-header">
          <div className="header-content">
            <div className="document-info">
              <div className="document-icon">
                <i className="fas fa-file-alt"></i>
              </div>
              <div className="document-details">
                <h2>{location.state?.filename || 'Document Viewer'}</h2>
                <p>Document ID: {location.state?.fileId}</p>
              </div>
            </div>
            <div className="header-actions">
              <Button 
                variant="outline-primary" 
                onClick={() => navigate('/assigned-documents')}
                className="action-btn"
              >
                <i className="fas fa-arrow-left me-2"></i>
                Back to Documents
              </Button>
              <Button 
                variant="success"
                onClick={() => navigate('/data-validation', { state: location.state })}
                className="action-btn"
              >
                <i className="fas fa-check me-2"></i>
                Validate Document
              </Button>
            </div>
          </div>
        </div>

        {/* Document Content with Tabs */}
        {fileData && (
          <div className="document-content">
            <Tabs defaultActiveKey="overview" className="content-tabs">
              <Tab eventKey="overview" title={
                <span>
                  <i className="fas fa-info-circle me-2"></i>
                  Overview
                </span>
              }>
                <div className="tab-content">
                  {renderMetadata(fileData.metadata)}
                  {renderObservations(fileData)}
                </div>
              </Tab>
              
              <Tab eventKey="content" title={
                <span>
                  <i className="fas fa-file-alt me-2"></i>
                  Content
                </span>
              }>
                <div className="tab-content">
                  {renderParts(fileData.parts)}
                </div>
              </Tab>
              
              <Tab eventKey="raw" title={
                <span>
                  <i className="fas fa-code me-2"></i>
                  Raw Data
                </span>
              }>
                <div className="tab-content">
                  <div className="raw-data-section">
                    <div className="section-header">
                      <div className="section-icon">
                        <i className="fas fa-code"></i>
                      </div>
                      <div className="section-title">
                        <h4>Raw JSON Data</h4>
                        <p>Complete technical data structure for developers</p>
                      </div>
                    </div>
                    <div className="raw-data-content">
                      <pre>{JSON.stringify(fileData, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              </Tab>
            </Tabs>
          </div>
        )}
      </div>

      <style>{`
        .file-viewer-container {
          min-height: 100vh;
         
          margin-top: 85px;
        }
        
        .viewer-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .viewer-header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .document-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .document-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.5rem;
        }
        
        .document-details h2 {
          margin: 0;
          color: #2c3e50;
          font-weight: 600;
        }
        
        .document-details p {
          margin: 0.5rem 0 0 0;
          color: #7f8c8d;
          font-size: 0.9rem;
        }
        
        .header-actions {
          display: flex;
          gap: 1rem;
        }
        
        .action-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 10px;
          font-weight: 500;
          transition: all 0.3s ease;
        }
        
        .action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }
        
        .document-content {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .content-tabs .nav-tabs {
          border: none;
          background: #f8f9fa;
          padding: 1rem 2rem 0 2rem;
        }
        
        .content-tabs .nav-link {
          border: none;
          background: transparent;
          color: #6c757d;
          font-weight: 500;
          padding: 1rem 1.5rem;
          border-radius: 10px 10px 0 0;
          transition: all 0.3s ease;
        }
        
        .content-tabs .nav-link.active {
          background: white;
          color: #667eea;
          box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.1);
        }
        
        .content-tabs .nav-link:hover {
          color: #667eea;
          background: rgba(102, 126, 234, 0.1);
        }
        
        .tab-content {
          padding: 2rem;
          min-height: 500px;
        }
        
        .section-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e9ecef;
        }
        
        .section-icon {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.2rem;
        }
        
        .section-title h4 {
          margin: 0;
          color: #2c3e50;
          font-weight: 600;
        }
        
        .section-title p {
          margin: 0.5rem 0 0 0;
          color: #7f8c8d;
          font-size: 0.9rem;
        }
        
        .metadata-section {
          margin-bottom: 3rem;
        }
        
        .metadata-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .metadata-item {
          background: white;
          border-radius: 15px;
          padding: 1.5rem;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
          border: 1px solid #e9ecef;
          display: flex;
          gap: 1rem;
          transition: all 0.3s ease;
        }
        
        .metadata-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        }
        
        .metadata-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1rem;
          flex-shrink: 0;
        }
        
        .metadata-content {
          flex: 1;
        }
        
        .metadata-label {
          font-weight: 600;
          color: #495057;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
          display: block;
        }
        
        .metadata-value {
          color: #212529;
          font-size: 0.95rem;
          line-height: 1.5;
        }
        
        .content-section {
          margin-bottom: 3rem;
        }
        
        .content-accordion .accordion-item {
          border: none;
          margin-bottom: 1rem;
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
        }
        
        .part-accordion-item .accordion-header {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
        }
        
        .part-header-content {
          display: flex;
          align-items: center;
          gap: 1rem;
          width: 100%;
        }
        
        .part-number {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.1rem;
        }
        
        .part-title h5 {
          margin: 0;
          font-weight: 600;
        }
        
        .part-subtitle {
          margin: 0.25rem 0 0 0;
          opacity: 0.8;
          font-size: 0.9rem;
        }
        
        .part-body {
          background: white;
          padding: 2rem;
        }
        
        .section-item {
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 12px;
          border-left: 4px solid #667eea;
        }
        
        .section-header-small {
          margin-bottom: 1rem;
        }
        
        .section-title {
          color: #2c3e50;
          font-weight: 600;
          margin: 0;
        }
        
        .content-block {
          margin-bottom: 1rem;
        }
        
        .paragraph-block {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          border-left: 3px solid #28a745;
        }
        
        .paragraph-block p {
          margin: 0;
          line-height: 1.6;
          color: #495057;
        }
        
        .table-block {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          border-left: 3px solid #17a2b8;
          overflow-x: auto;
        }
        
        .table-block table {
          width: 100%;
          border-collapse: collapse;
          margin: 0;
        }
        
        .table-block th,
        .table-block td {
          border: 1px solid #dee2e6;
          padding: 12px;
          text-align: left;
        }
        
        .table-block th {
          background: #f8f9fa;
          font-weight: 600;
          color: #495057;
        }
        
        .subsection-item {
          margin-top: 1.5rem;
          padding: 1rem;
          background: white;
          border-radius: 8px;
          border-left: 3px solid #ffc107;
        }
        
        .subsection-header {
          margin-bottom: 1rem;
        }
        
        .subsection-title {
          color: #856404;
          font-weight: 600;
          margin: 0;
        }
        
        .observations-section {
          margin-bottom: 3rem;
        }
        
        .observations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
        }
        
        .observation-card {
          background: white;
          border-radius: 15px;
          padding: 1.5rem;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
          border-left: 4px solid #ffc107;
          display: flex;
          gap: 1rem;
          transition: all 0.3s ease;
        }
        
        .observation-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        }
        
        .observation-number {
          width: 40px;
          height: 40px;
          background: #ffc107;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          flex-shrink: 0;
        }
        
        .observation-content p {
          margin: 0;
          line-height: 1.6;
          color: #495057;
        }
        
        .raw-data-section {
          background: #2c3e50;
          border-radius: 15px;
          overflow: hidden;
        }
        
        .raw-data-content {
          background: #34495e;
          padding: 2rem;
          max-height: 500px;
          overflow: auto;
        }
        
        .raw-data-content pre {
          color: #ecf0f1;
          font-family: 'Courier New', monospace;
          font-size: 0.9rem;
          line-height: 1.5;
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        
        @media (max-width: 768px) {
          .viewer-content {
            padding: 1rem;
          }
          
          .header-content {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .header-actions {
            width: 100%;
            justify-content: stretch;
          }
          
          .action-btn {
            flex: 1;
          }
          
          .metadata-grid {
            grid-template-columns: 1fr;
          }
          
          .observations-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default FileViewer;
