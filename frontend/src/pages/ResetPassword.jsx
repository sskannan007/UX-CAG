import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import onboardingImage from '../assets/onboarding.png';
import '../styles/login.scss';
import config from '../config';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const email = location.state?.email;
  const token = location.state?.token;

  useEffect(() => {
    if (!email || !token) {
      navigate('/forgot-password');
    }
  }, [email, token, navigate]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validation
      if (!newPassword || !confirmPassword) {
        setError('Please fill in all fields');
        setIsLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters long');
        setIsLoading(false);
        return;
      }

      // Make API call to reset password
      const response = await fetch(`${config.BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          token: token,
          new_password: newPassword
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }
      
      // Success - show success message in the same page
      setIsSuccess(true);
      
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    // Navigate to login page without any message
    navigate('/login');
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
              {!isSuccess ? (
                <>
                  {/* Title and subtext */}
                  <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h2 style={{ 
                      textAlign: 'center', 
                      marginBottom: '12px',
                      color: '#333',
                      fontSize: '28px',
                      fontWeight: '600'
                    }}>
                      Reset Password
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
                      Enter your new password and confirm it to complete the reset process.
                    </p>
                  </div>

                  {error && (
                    <div className="error-message">
                      <span>⚠️</span>
                      {error}
                    </div>
                  )}
                  
                  <form onSubmit={handleResetPassword} className="login-form">
                    <div className="form-group">
                      <input 
                        type="password" 
                        className="form-input" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <input 
                        type="password" 
                        className="form-input" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm New Password"
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
                          Resetting...
                        </>
                      ) : (
                        'Reset Password'
                      )}
                    </button>
                  </form>

                  <div className="signup-link" style={{ marginTop: '20px' }}>
                    <span>Remember your password? </span>
                    <a href="#" onClick={() => navigate('/login')}>Back to Login</a>
                  </div>
                </>
              ) : (
                <>
                  {/* Success State */}
                  <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h2 style={{ 
                      textAlign: 'center', 
                      marginBottom: '12px',
                      color: '#333',
                      fontSize: '28px',
                      fontWeight: '600'
                    }}>
                      Reset Password
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
                      Set the new password for your account so you can login and access all features.
                    </p>
                  </div>

                  {/* Success Icon and Message */}
                  <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      backgroundColor: '#28a745',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 20px auto'
                    }}>
                      <span style={{
                        color: 'white',
                        fontSize: '40px',
                        fontWeight: 'bold'
                      }}>✓</span>
                    </div>
                    <p style={{
                      color: '#28a745',
                      fontSize: '18px',
                      fontWeight: '600',
                      margin: '0'
                    }}>
                      Password Updated successfully!
                    </p>
                  </div>

                  <button 
                    type="button" 
                    className="signin-btn"
                    onClick={handleContinue}
                  >
                    Continue
                  </button>
                </>
              )}
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

export default ResetPassword;