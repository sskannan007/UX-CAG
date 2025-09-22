import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import onboardingImage from '../assets/onboarding.png';
import '../styles/registration.scss';
import config from '../config';

const Registration = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [dob, setDob] = useState('');
  const [place, setPlace] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Check if user is already logged in
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/home" replace />;
  }

  const handleRegistration = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Simple validation
      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        setError('Please fill in required fields');
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }
      
      // Create user data object to send to API
      const userData = {
        firstname: firstName,
        lastname: lastName,
        email: email,
        password: password,
        dob: dob || null,
        contactno: contactNo || null,
        place: place || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        gender: gender || null
      };
      
      // Make API call to register user
      const response = await fetch(`${config.BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }
      
      // Show success message and navigate to login page
      alert('Registration successful! Please login with your credentials.');
      navigate('/login');
        
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Placeholder for Google login
    console.log('Google login clicked');
  };

  const handleFacebookLogin = () => {
    // Placeholder for Facebook login
    console.log('Facebook login clicked');
  };

  const navigateToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="registration-container">
      {/* Logo positioned at top-left of page, outside container */}
      <div className="page-logo">
        <img src={logoImage} alt="Logo" className="logo-image" />
      </div>
      
      <div className="registration-content">
        <div className="registration-form-section">
          <div className="registration-form-container-wrapper">
            <div className="welcome-section">
              <p style={{color: 'black', textAlign: 'center'}}>Please provide below details to secure your verified ProofBox account</p>
            </div>

            <div className="registration-form-container">
              {error && (
                <div className="error-message">
                  <span>⚠️</span>
                  {error}
                </div>
              )}
              
              <form onSubmit={handleRegistration} className="registration-form">
                <div className="scrollable-form-area">
                  <div className="form-row">
                    <div className="form-group half">
                      <input 
                        type="text" 
                        className="form-input" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First Name"
                        required
                      />
                    </div>
                    <div className="form-group half">
                      <input 
                        type="text" 
                        className="form-input" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last Name"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group half">
                      <input 
                        type="email" 
                        className="form-input" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email@gmail.com"
                        required
                      />
                    </div>
                    <div className="form-group half">
                      <input 
                        type="tel" 
                        className="form-input" 
                        value={contactNo}
                        onChange={(e) => setContactNo(e.target.value)}
                        placeholder="Contact Number"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group half">
                      <input 
                        type="date" 
                        className="form-input" 
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        placeholder="Date of Birth"
                      />
                    </div>
                    <div className="form-group half">
                      <input 
                        type="text" 
                        className="form-input" 
                        value={place}
                        onChange={(e) => setPlace(e.target.value)}
                        placeholder="Place"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group half">
                      <input 
                        type="text" 
                        className="form-input" 
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div className="form-group half">
                      <input 
                        type="text" 
                        className="form-input" 
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="State"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group half">
                      <input 
                        type="text" 
                        className="form-input" 
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="Pincode"
                      />
                    </div>
                    <div className="form-group half">
                      <select
                        className="form-input"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <option value="" disabled>Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <input 
                      type="password" 
                      className="form-input" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <input 
                      type="password" 
                      className="form-input" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      required
                    />
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  className="create-account-btn"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      Creating Account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              <div className="divider">
                <span>Or</span>
              </div>

              <div className="social-login">
                <button 
                  type="button" 
                  className="social-btn google-btn"
                  onClick={handleGoogleLogin}
                >
                  <span className="google-icon">G</span>
                  Sign in with Google
                </button>
                
                <button 
                  type="button" 
                  className="social-btn facebook-btn"
                  onClick={handleFacebookLogin}
                >
                  <span className="facebook-icon">f</span>
                  Sign in with Facebook
                </button>
              </div>

              <div className="login-link">
                <span>Already have an account? </span>
                <a href="#" onClick={navigateToLogin}>Login</a>
              </div>
            </div>
          </div>
        </div>

        <div className="registration-image-section">
          <div className="image-container">
            <img src={onboardingImage} alt="Onboarding" className="onboarding-image" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Registration;