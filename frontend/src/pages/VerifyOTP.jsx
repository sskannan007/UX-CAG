import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import onboardingImage from '../assets/onboarding.png';
import '../styles/login.scss';
import config from '../config';

const VerifyOTP = () => {
  const [otp, setOtp] = useState(['', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef([]);
  
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const otpCode = otp.join('');
      if (otpCode.length !== 5) {
        setError('Please enter the complete 5-digit code');
        setIsLoading(false);
        return;
      }

      // Make API call to verify OTP
      const response = await fetch(`${config.BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          otp: otpCode
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Invalid verification code');
      }
      
      // Navigate to reset password page with verification token
      navigate('/reset-password', { state: { email, token: data.reset_token } });
      
    } catch (err) {
      // Set a specific error message for invalid OTP
      const errorMessage = err.message || 'Verification failed. Please try again.';
      if (errorMessage.includes('Invalid') || errorMessage.includes('expired') || errorMessage.includes('verification')) {
        setError('Please enter valid OTP');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError('');

    try {
      const response = await fetch(`${config.BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to resend code');
      }
      
      setOtp(['', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
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
              {/* Title and subtext */}
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h2 style={{ 
                  textAlign: 'center', 
                  marginBottom: '12px',
                  color: '#333',
                  fontSize: '28px',
                  fontWeight: '600'
                }}>
                  Verification
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
                  Enter your 5 digits code that you received on your email.
                </p>
              </div>

              <form onSubmit={handleVerify} className="login-form">
                {/* OTP Input Fields */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '12px', 
                  marginBottom: error ? '10px' : '30px' 
                }}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      style={{
                        width: '50px',
                        height: '50px',
                        textAlign: 'center',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        border: error ? '2px solid #dc3545' : '2px solid #e0e0e0',
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        backgroundColor: error ? '#fff5f5' : 'white'
                      }}
                      onFocus={(e) => {
                        if (!error) {
                          e.target.style.borderColor = '#007bff';
                        }
                      }}
                      onBlur={(e) => {
                        if (!error) {
                          e.target.style.borderColor = '#e0e0e0';
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Error message below OTP fields */}
                {error && (
                  <div style={{
                    textAlign: 'center',
                    color: '#dc3545',
                    fontSize: '14px',
                    marginBottom: '20px',
                    fontWeight: '500'
                  }}>
                    {error}
                  </div>
                )}

                <button 
                  type="submit" 
                  className="signin-btn"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      Verifying...
                    </>
                  ) : (
                    'Verify'
                  )}
                </button>
              </form>

              {/* Resend Code Link */}
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>Did not receive OTP? </span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#007bff',
                    fontSize: '14px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '0'
                  }}
                >
                  {isResending ? 'Sending...' : 'Resend code'}
                </button>
              </div>

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

export default VerifyOTP;