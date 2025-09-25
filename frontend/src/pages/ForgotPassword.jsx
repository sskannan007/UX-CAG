import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import onboardingImage from '../assets/onboarding.png';
import '../styles/login.scss';
import config from '../config';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleContinue = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Simple validation
      if (!email) {
        setError('Please enter your email');
        setIsLoading(false);
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }

      // Make API call to send OTP to email
      const response = await fetch(`${config.BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send verification code');
      }
      
      // Navigate to OTP verification page with email
      navigate('/verify-otp', { state: { email } });
      
    } catch (err) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Logo positioned at top-left of page, outside container */}
      <div className="page-logo">
        <img src={logoImage} alt="Logo" className="logo-image" />
      </div>
      
      <div className="login-content">
        <div className="login-form-section">
          <div className="login-form-container-wrapper">

            <div className="login-form-container">
              {/* Title and subtext moved inside form container and centered */}
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h2 style={{ 
                  textAlign: 'center', 
                  marginBottom: '12px',
                  color: '#333',
                  fontSize: '28px',
                  fontWeight: '600'
                }}>
                  Forgot Password
                </h2>
                <p style={{ 
                  textAlign: 'center', 
                  color: '#666',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  margin: '0',
                  maxWidth: '350px',
                  marginLeft: 'auto',
                  marginRight: 'auto'
                }}>
                  Enter your email for the verification process we will send 4 digits code to your email.
                </p>
              </div>

              {error && (
                <div className="error-message">
                  <span>⚠️</span>
                  {error}
                </div>
              )}
              
              <form onSubmit={handleContinue} className="login-form">
                <div className="form-group">
                  <input 
                    type="email" 
                    className="form-input" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email id"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="signin-btn"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      Sending...
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>

              <div className="signup-link" style={{ marginTop: '20px' }}>
                <span>Remember your password? </span>
                <a href="#" onClick={() => navigate('/login')}>Back to Login</a>
              </div>
            </div>
          </div>
        </div>

        <div className="login-image-section">
          <div className="image-container">
            <img src={onboardingImage} alt="Onboarding" className="onboarding-image" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;