import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsArrowLeft, BsArrowRight, BsCheck } from 'react-icons/bs';
import config from '../config.js';

const CreateUser = () => {
  const navigate = useNavigate();
  
  // Prevent body scroll when component mounts
  useEffect(() => {
    // Save the current body overflow style
    const originalStyle = window.getComputedStyle(document.body).overflow;
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Cleanup function to restore original overflow when component unmounts
    return () => {
      document.body.style.overflow = originalStyle;
    };
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
      <div className="row mb-3">
        <div className="col-12">
          <div className="d-flex justify-content-center align-items-center">
            <div className={`text-center ${currentStep >= 1 ? 'text-primary' : 'text-muted'}`}>
              <div className={`rounded-circle d-inline-flex align-items-center justify-content-center ${currentStep >= 1 ? 'bg-primary text-white' : 'bg-light'}`} style={{width: '35px', height: '35px'}}>
                {currentStep > 1 ? <BsCheck size={16} /> : '1'}
              </div>
              <div className="mt-1 small">User Information</div>
            </div>
            <div className={`flex-grow-1 ${currentStep > 1 ? 'bg-primary' : 'bg-light'}`} style={{height: '2px', margin: '0 20px', maxWidth: '150px'}}></div>
            
            <div className={`text-center ${currentStep >= 2 ? 'text-primary' : 'text-muted'}`}>
              <div className={`rounded-circle d-inline-flex align-items-center justify-content-center ${currentStep >= 2 ? 'bg-primary text-white' : 'bg-light'}`} style={{width: '35px', height: '35px'}}>
                {currentStep > 2 ? <BsCheck size={16} /> : '2'}
              </div>
              <div className="mt-1 small">Add Location</div>
            </div>
            <div className={`flex-grow-1 ${currentStep > 2 ? 'bg-primary' : 'bg-light'}`} style={{height: '2px', margin: '0 20px', maxWidth: '150px'}}></div>
            
            <div className={`text-center ${currentStep >= 3 ? 'text-primary' : 'text-muted'}`}>
              <div className={`rounded-circle d-inline-flex align-items-center justify-content-center ${currentStep >= 3 ? 'bg-primary text-white' : 'bg-light'}`} style={{width: '35px', height: '35px'}}>
                3
              </div>
              <div className="mt-1 small">Confirmation</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid p-4" style={{ 
      height: '100vh', 
      overflow: 'hidden',
      maxHeight: '100vh'
    }}>
      {/* Header */}
      <div className="d-flex align-items-center mb-2">
        <button 
          className="btn btn-link text-decoration-none p-0 me-3" 
          onClick={() => navigate('/user-management')}
          style={{ border: 'none' }}
        >
          <BsArrowLeft className="me-2" /> back
        </button>
        <div>
          <h4 className="mb-0">Create New User</h4>
          <p className="text-muted mb-0 small">Add a new user to the system</p>
        </div>
      </div>

      {/* Progress Steps */}
      {renderProgressSteps()}

      {/* Main Content Card */}
      <div className="card shadow-sm" style={{ height: 'calc(100vh - 300px)' }}>
        <div className="card-body p-3" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Step Title */}
          <div className="text-center mb-2">
            <h6 className="mb-1">
              {currentStep === 1 && 'User Information'}
              {currentStep === 2 && 'Add Location'}
              {currentStep === 3 && 'Confirmation'}
            </h6>
            <p className="text-muted mb-0 small">
              {currentStep === 1 && 'Enter the basic information for the new user'}
              {currentStep === 2 && 'Add location details for the user'}
              {currentStep === 3 && 'Review information and set password'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {/* Step 1: User Information */}
          {currentStep === 1 && (
            <div className="flex-grow-1">
              <div className="row justify-content-center">
                <div className="col-lg-10">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">First Name <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Enter First name"
                          value={userData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">Last Name <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Enter Last name"
                          value={userData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">Date of Birth</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={userData.dateOfBirth}
                          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">Gender <span className="text-danger">*</span></label>
                        <select
                          className="form-select form-select-sm"
                          value={userData.gender}
                          onChange={(e) => handleInputChange('gender', e.target.value)}
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">Email (Login ID) <span className="text-danger">*</span></label>
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          placeholder="Enter Email ID"
                          value={userData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">Phone Number <span className="text-danger">*</span></label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">+91</span>
                          <input
                            type="tel"
                            className="form-control"
                            placeholder="Enter Phone Number"
                            value={userData.phoneNumber}
                            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location Information */}
          {currentStep === 2 && (
            <div className="flex-grow-1">
              <div className="row justify-content-center">
                <div className="col-lg-10">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">Place <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Enter Place"
                          value={userData.place}
                          onChange={(e) => handleInputChange('place', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">City <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Enter City"
                          value={userData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">State <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Enter State"
                          value={userData.state}
                          onChange={(e) => handleInputChange('state', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <label className="form-label small">Pincode <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Enter Pincode"
                          value={userData.pincode}
                          onChange={(e) => handleInputChange('pincode', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation and Password */}
          {currentStep === 3 && (
            <div className="flex-grow-1">
              <div className="row justify-content-center">
                <div className="col-lg-10">
                  <div className="row">
                    <div className="col-md-12">
                      <h6 className="mb-2 small">Review Information</h6>
                      <div className="bg-light p-2 rounded mb-2">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-1 small">
                              <strong>Name:</strong> {userData.firstName} {userData.lastName}
                            </div>
                            <div className="mb-1 small">
                              <strong>Email:</strong> {userData.email}
                            </div>
                            <div className="mb-1 small">
                              <strong>Phone:</strong> +91 {userData.phoneNumber}
                            </div>
                            <div className="mb-1 small">
                              <strong>Gender:</strong> {userData.gender}
                            </div>
                            {userData.dateOfBirth && (
                              <div className="mb-1 small">
                                <strong>DOB:</strong> {userData.dateOfBirth}
                              </div>
                            )}
                          </div>
                          <div className="col-md-6">
                            <div className="mb-1 small">
                              <strong>Place:</strong> {userData.place}
                            </div>
                            <div className="mb-1 small">
                              <strong>City:</strong> {userData.city}
                            </div>
                            <div className="mb-1 small">
                              <strong>State:</strong> {userData.state}
                            </div>
                            <div className="mb-1 small">
                              <strong>Pincode:</strong> {userData.pincode}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <h6 className="mb-2 small">Set Password</h6>
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-2">
                            <label className="form-label small">Password <span className="text-danger">*</span></label>
                            <input
                              type="password"
                              className="form-control form-control-sm"
                              placeholder="Enter Password"
                              value={userData.password}
                              onChange={(e) => handleInputChange('password', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-2">
                            <label className="form-label small">Confirm Password <span className="text-danger">*</span></label>
                            <input
                              type="password"
                              className="form-control form-control-sm"
                              placeholder="Confirm Password"
                              value={userData.confirmPassword}
                              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="row mt-2 flex-shrink-0">
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  {currentStep > 1 && (
                    <button 
                      type="button" 
                      className="btn btn-link text-decoration-none p-2"
                      onClick={prevStep}
                      style={{ border: 'none' }}
                    >
                      <BsArrowLeft className="me-2" /> Previous
                    </button>
                  )}
                </div>
                <div>
                  {currentStep < 3 ? (
                    <button 
                      type="button" 
                      className="btn btn-primary px-4"
                      onClick={nextStep}
                    >
                      Save & Next <BsArrowRight className="ms-2" />
                    </button>
                  ) : (
                    <button 
                      type="button" 
                      className="btn btn-primary px-4"
                      onClick={createUser}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Creating User...
                        </>
                      ) : (
                        'Create User'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateUser;