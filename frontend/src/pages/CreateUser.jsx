import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsArrowLeft, BsArrowRight, BsCheck } from 'react-icons/bs';
import { Container, Card, Row, Col, Button, Form, InputGroup } from 'react-bootstrap';
import config from '../config.js';
import '../styles/dashboard.scss';

const CreateUser = () => {
  const navigate = useNavigate();
  
  // Component mounted - no need to prevent body scroll
  useEffect(() => {
    // Allow normal scrolling behavior
  }, []);
  
  // State for multi-step form
  const [currentStep, setCurrentStep] = useState(1);
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    phoneNumber: '',
    gender: '',
    place: '',
    city: '',
    state: '',
    pincode: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle input changes
  const handleInputChange = (field, value) => {
    setUserData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // Validation functions
  const validateStep1 = () => {
    const { firstName, lastName, email, phoneNumber, gender } = userData;
    if (!firstName || !lastName || !email || !phoneNumber || !gender) {
      setError('Please fill in all required fields');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const { place, city, state, pincode } = userData;
    if (!place || !city || !state || !pincode) {
      setError('Please fill in all location fields');
      return false;
    }
    if (!/^\d{6}$/.test(pincode)) {
      setError('Please enter a valid 6-digit pincode');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const { password, confirmPassword } = userData;
    if (!password || !confirmPassword) {
      setError('Please enter and confirm password');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    return true;
  };

  // Navigation functions
  const nextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Create user function
  const createUser = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const newUserData = {
        firstname: userData.firstName,
        lastname: userData.lastName,
        email: userData.email,
        contactno: userData.phoneNumber,
        place: userData.place,
        city: userData.city,
        state: userData.state,
        pincode: userData.pincode,
        password: userData.password,
        gender: userData.gender,
        dob: userData.dateOfBirth
      };

      const response = await fetch(`${config.BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUserData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create user');
      }

      // Success - redirect back to user management with success message
      navigate('/user-management', { 
        state: { 
          message: 'User created successfully!',
          type: 'success' 
        } 
      });
      
    } catch (err) {
      console.error("Create user error:", err);
      setError(`Failed to create user: ${err.message}`);
      setLoading(false);
    }
  };

  // Render progress indicators
  const renderProgressSteps = () => {
    return (
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-center">
            <div 
              className="d-flex align-items-center" 
              style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '25px',
                padding: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {/* Step 1: User Information */}
              <div 
                className={`d-flex align-items-center px-3 py-2 rounded-pill ${
                  currentStep >= 1 
                    ? 'text-dark' 
                    : 'text-muted'
                }`}
                style={{
                  backgroundColor: currentStep >= 1 ? '#EDEEF1' : 'transparent',
                  minWidth: '180px',
                  justifyContent: 'center'
                }}
              >
                <div 
                  className={`rounded-circle d-flex align-items-center justify-content-center me-3 ${
                    currentStep > 1 
                      ? 'bg-success text-white' 
                      : currentStep >= 1 
                        ? 'bg-dark text-white' 
                        : 'bg-secondary text-white'
                  }`}
                  style={{
                    width: '32px', 
                    height: '32px', 
                    fontSize: '14px', 
                    fontWeight: '600'
                  }}
                >
                  {currentStep > 1 ? <BsCheck size={16} /> : '1'}
                </div>
                <span style={{fontSize: '14px', fontWeight: '500'}}>User Information</span>
              </div>

              {/* Chevron Separator 1 */}
              <div className="mx-2" style={{ color: '#6c757d', fontSize: '16px' }}>
                <i className="fas fa-chevron-right"></i>
              </div>

              {/* Step 2: Add Location and Role */}
              <div 
                className={`d-flex align-items-center px-3 py-2 rounded-pill ${
                  currentStep >= 2 
                    ? 'text-dark' 
                    : 'text-muted'
                }`}
                style={{
                  backgroundColor: currentStep === 2 ? '#ffffff' : 'transparent',
                  minWidth: '200px',
                  justifyContent: 'center',
                  boxShadow: currentStep === 2 ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                  border: currentStep === 2 ? '1px solid #e9ecef' : 'none'
                }}
              >
                <div 
                  className={`rounded-circle d-flex align-items-center justify-content-center me-3 ${
                    currentStep > 2 
                      ? 'bg-success text-white' 
                      : currentStep >= 2 
                        ? 'bg-dark text-white' 
                        : 'bg-secondary text-white'
                  }`}
                  style={{
                    width: '32px', 
                    height: '32px', 
                    fontSize: '14px', 
                    fontWeight: '600'
                  }}
                >
                  {currentStep > 2 ? <BsCheck size={16} /> : '2'}
                </div>
                <span style={{fontSize: '14px', fontWeight: '500'}}>Add Location and Role</span>
              </div>

              {/* Chevron Separator 2 */}
              <div className="mx-2" style={{ color: '#6c757d', fontSize: '16px' }}>
                <i className="fas fa-chevron-right"></i>
              </div>

              {/* Step 3: Confirmation */}
              <div 
                className={`d-flex align-items-center px-3 py-2 rounded-pill ${
                  currentStep >= 3 
                    ? 'text-dark' 
                    : 'text-muted'
                }`}
                style={{
                  backgroundColor: currentStep >= 3 ? '#ffffff' : 'transparent',
                  minWidth: '150px',
                  justifyContent: 'center'
                }}
              >
                <div 
                  className={`rounded-circle d-flex align-items-center justify-content-center me-3 ${
                    currentStep >= 3 
                      ? 'bg-dark text-white' 
                      : 'bg-secondary text-white'
                  }`}
                  style={{
                    width: '32px', 
                    height: '32px', 
                    fontSize: '14px', 
                    fontWeight: '600'
                  }}
                >
                  3
                </div>
                <span style={{fontSize: '14px', fontWeight: '500'}}>Confirmation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid py-4 scroll-style">
      {/* Breadcrumbs */}
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                navigate('/user-management');
              }}
              className="text-decoration-none"
            >
              Home
            </a>
          </li>
          <li className="breadcrumb-item">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                navigate('/user-management');
              }}
              className="text-decoration-none"
            >
              Settings & Configurations
            </a>
          </li>
          <li className="breadcrumb-item active">Role management</li>
        </ol>
      </nav>

      {/* Progress Steps */}
      {renderProgressSteps()}

      {/* Main Content Card */}
      <Card className="shadow-sm main-user-card" style={{ border: 'none', backgroundColor: '#F2F3F7', padding: '0 16px' }}>
        <Card.Body className="p-0" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Step Title */}
          <div className="text-left">
            <h4 className="mb-0" style={{fontWeight: '600', color: '#1E1E16'}}>
              {currentStep === 1 && 'New User information'}
              {currentStep === 2 && 'Add Location and Role'}
              {currentStep === 3 && 'Confirmation'}
            </h4>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {/* Step 1: User Information */}
          {currentStep === 1 && (
            <div style={{ backgroundColor: '#F2F3F7', padding: '20px' }}>
              <Row>
                {/* Left Column - Form Fields */}
                <Col md={8} className='new-user-info-col' style={{ backgroundColor: '#FFFFFf', padding: '24px', borderRadius: '8px' }}>
                  <Row className='new-user-info'>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          First Name <span className="text-danger">*</span>
                        </label>
                        <Form.Control
                          type="text"
                          placeholder="Enter First name"
                          value={userData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          Last Name <span className="text-danger">*</span>
                        </label>
                        <Form.Control
                          type="text"
                          placeholder="Enter Last name"
                          value={userData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          Email (Login ID) <span className="text-danger">*</span>
                        </label>
                        <Form.Control
                          type="email"
                          placeholder="Enter Email ID"
                          value={userData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          Phone Number <span className="text-danger">*</span>
                        </label>
                        <InputGroup>
                          <InputGroup.Text style={{borderRadius: '6px 0 0 6px', border: '1px solid #d1d5db', backgroundColor: '#f9fafb'}}>
                            +1
                          </InputGroup.Text>
                          <Form.Control
                            type="tel"
                            placeholder="Enter Phone Number"
                            value={userData.phoneNumber}
                            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                            style={{borderRadius: '0 6px 6px 0', border: '1px solid #d1d5db'}}
                          />
                        </InputGroup>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          Date of Birth
                        </label>
                        <Form.Control
                          type="date"
                          value={userData.dateOfBirth}
                          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                          style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          Gender <span className="text-danger">*</span>
                        </label>
                        <Form.Select
                          value={userData.gender}
                          onChange={(e) => handleInputChange('gender', e.target.value)}
                          style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </Form.Select>
                      </div>
                    </Col>
                  </Row>
                </Col>
                
                {/* Right Column - Profile Picture */}
                <Col className='new-user-profile-picture' md={2} style={{ backgroundColor: '#FFFFFf', marginLeft: '16px', padding: '24px', borderRadius: '8px' }}>
                  <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '400px' }}>
                    <div 
                      className="d-flex flex-column align-items-center justify-content-center"
                      style={{
                        width: '200px',
                        height: '200px',
                        border: '2px dashed #d1d5db',
                        borderRadius: '12px',
                        backgroundColor: '#f9fafb',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.backgroundColor = '#eff6ff';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.backgroundColor = '#f9fafb';
                      }}
                    >
                      <i className="fas fa-user" style={{fontSize: '48px', color: '#9ca3af', marginBottom: '12px'}}></i>
                      <span style={{color: '#6b7280', fontSize: '14px', fontWeight: '500'}}>
                        Add Profile Picture
                      </span>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {/* Step 2: Location Information */}
          {currentStep === 2 && (
            <div style={{ backgroundColor: '#F2F3F7', padding: '20px' }}>
              <Row>
                <Col md={8} style={{ backgroundColor: '#FFFFFf', padding: '24px', borderRadius: '8px' }}>
                  <Row>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          Place <span className="text-danger">*</span>
                        </label>
                        <Form.Control
                          type="text"
                          placeholder="Enter Place"
                          value={userData.place}
                          onChange={(e) => handleInputChange('place', e.target.value)}
                          style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          City <span className="text-danger">*</span>
                        </label>
                        <Form.Control
                          type="text"
                          placeholder="Enter City"
                          value={userData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          State <span className="text-danger">*</span>
                        </label>
                        <Form.Control
                          type="text"
                          placeholder="Enter State"
                          value={userData.state}
                          onChange={(e) => handleInputChange('state', e.target.value)}
                          style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                          Pincode <span className="text-danger">*</span>
                        </label>
                        <Form.Control
                          type="text"
                          placeholder="Enter Pincode"
                          value={userData.pincode}
                          onChange={(e) => handleInputChange('pincode', e.target.value)}
                          style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                      </div>
                    </Col>
                  </Row>
                </Col>
              </Row>
            </div>
          )}

          {/* Step 3: Confirmation and Password */}
          {currentStep === 3 && (
            <div style={{ backgroundColor: '#F2F3F7', padding: '20px' }}>
              <Row>
                <Col md={8} style={{ backgroundColor: '#FFFFFf', padding: '24px', borderRadius: '8px' }}>
                  <div className="mb-4">
                    <h6 className="mb-3" style={{fontWeight: '600', color: '#374151'}}>Review Information</h6>
                    <div className="bg-light p-3 rounded" style={{border: '1px solid #e5e7eb'}}>
                      <Row>
                        <Col md={6}>
                          <div className="mb-2">
                            <strong style={{color: '#374151'}}>Name:</strong> 
                            <span className="ms-2" style={{color: '#6b7280'}}>{userData.firstName} {userData.lastName}</span>
                          </div>
                          <div className="mb-2">
                            <strong style={{color: '#374151'}}>Email:</strong> 
                            <span className="ms-2" style={{color: '#6b7280'}}>{userData.email}</span>
                          </div>
                          <div className="mb-2">
                            <strong style={{color: '#374151'}}>Phone:</strong> 
                            <span className="ms-2" style={{color: '#6b7280'}}>+1 {userData.phoneNumber}</span>
                          </div>
                          <div className="mb-2">
                            <strong style={{color: '#374151'}}>Gender:</strong> 
                            <span className="ms-2" style={{color: '#6b7280'}}>{userData.gender}</span>
                          </div>
                          {userData.dateOfBirth && (
                            <div className="mb-2">
                              <strong style={{color: '#374151'}}>DOB:</strong> 
                              <span className="ms-2" style={{color: '#6b7280'}}>{userData.dateOfBirth}</span>
                            </div>
                          )}
                        </Col>
                        <Col md={6}>
                          <div className="mb-2">
                            <strong style={{color: '#374151'}}>Place:</strong> 
                            <span className="ms-2" style={{color: '#6b7280'}}>{userData.place}</span>
                          </div>
                          <div className="mb-2">
                            <strong style={{color: '#374151'}}>City:</strong> 
                            <span className="ms-2" style={{color: '#6b7280'}}>{userData.city}</span>
                          </div>
                          <div className="mb-2">
                            <strong style={{color: '#374151'}}>State:</strong> 
                            <span className="ms-2" style={{color: '#6b7280'}}>{userData.state}</span>
                          </div>
                          <div className="mb-2">
                            <strong style={{color: '#374151'}}>Pincode:</strong> 
                            <span className="ms-2" style={{color: '#6b7280'}}>{userData.pincode}</span>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </div>
                  
                  <div>
                    <h6 className="mb-3" style={{fontWeight: '600', color: '#374151'}}>Set Password</h6>
                    <Row>
                      <Col md={6}>
                        <div className="mb-3">
                          <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                            Password <span className="text-danger">*</span>
                          </label>
                          <Form.Control
                            type="password"
                            placeholder="Enter Password"
                            value={userData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                          />
                        </div>
                      </Col>
                      <Col md={6}>
                        <div className="mb-3">
                          <label className="form-label" style={{fontWeight: '500', color: '#374151'}}>
                            Confirm Password <span className="text-danger">*</span>
                          </label>
                          <Form.Control
                            type="password"
                            placeholder="Confirm Password"
                            value={userData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            style={{borderRadius: '6px', border: '1px solid #d1d5db'}}
                          />
                        </div>
                      </Col>
                    </Row>
                  </div>
                </Col>
              </Row>
            </div>
          )}

        </Card.Body>
      </Card>
      
      {/* Navigation Buttons - Fixed at bottom */}
      <div 
        className="row mt-4" 
        style={{
          position: 'sticky',
          bottom: '0',
          backgroundColor: '#F2F3F7',
          padding: '0 16px 0',
          margin: '0 -15px',
          paddingLeft: '15px',
          paddingRight: '15px',
          zIndex: 10
        }}
      >
        <div className="col-12">
          <div className="d-flex justify-content-start align-items-center gap-3">
                {currentStep < 3 ? (
                  <Button 
                    variant="primary" 
                    onClick={nextStep}
                    style={{
                      backgroundColor: '#0D61AE',
                      borderColor: '#0D61AE',
                      borderRadius: '6px',
                      padding: '12px 24px',
                      fontWeight: '500',
                      fontSize: '14px'
                    }}
                  >
                    Save & Next
                  </Button>
                ) : (
                  <Button 
                    variant="primary" 
                    onClick={createUser}
                    disabled={loading}
                    style={{
                      backgroundColor: '#0D61AE',
                      borderColor: '#0D61AE',
                      borderRadius: '6px',
                      padding: '12px 24px',
                      fontWeight: '500',
                      fontSize: '14px'
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Creating User...
                      </>
                    ) : (
                      'Create User'
                    )}
                  </Button>
                )}
                <Button 
                  variant="outline-secondary" 
                  onClick={() => navigate('/user-management')}
                  style={{
                    borderColor: '#d1d5db',
                    color: '#6b7280',
                    borderRadius: '6px',
                    padding: '12px 24px',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
    </div>
  );
};

export default CreateUser;