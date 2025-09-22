import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import onboardingImage from '../assets/onboarding.png';
import '../styles/login.scss';
import config from '../config';

const Login = ({ setUserConfig }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Check if user is already logged in
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/home" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Simple validation
      if (!email || !password) {
        setError('Please enter both email and password');
        setIsLoading(false);
        return;
      }

      // Make API call to login
      const response = await fetch(`${config.BASE_URL}/api/auth/token-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }
      
      // Store token in localStorage
      localStorage.setItem('token', data.access_token);
      
      // Fetch user information
      const userResponse = await fetch(`${config.BASE_URL}/api/user/me`, {
        headers: {
          'Authorization': `Bearer ${data.access_token}`
        }
      });
      
      const userData = await userResponse.json();
      
      // Update user config based on role
      if (setUserConfig) {
        // Default config for all users
        const userConfig = {
          home: true,
          about: true
        };
        
        // Additional permissions based on role
        if (userData.role_status === 'admin') {
          userConfig.bulkUpload = true;
          userConfig.dataValidation = true;
          userConfig.assignedDocuments = true;
          userConfig.admin = true;
          userConfig.users = true;
          userConfig.user_management = true;
          userConfig.audit_logs = true;
        } else if (userData.role_status === 'user') {
          userConfig.assignedDocuments = true;
        }
        
        setUserConfig(userConfig);
      }
      
      // Save user data for later use
      localStorage.setItem('user_data', JSON.stringify({
        id: userData.id,
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: userData.email,
        role_status: userData.role_status
      }));
      
      // Navigate to home page
      navigate('/home');
        
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
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

  return (
    <div className="login-container">
      {/* Logo positioned at top-left of page, outside container */}
      <div className="page-logo">
        <img src={logoImage} alt="Logo" className="logo-image" />
      </div>
      
      <div className="login-content">
        <div className="login-form-section">
          <div className="login-form-container-wrapper">
            <div className="welcome-section">
              <h2>Welcome to Proof Box</h2>
              <p>Access your assigned documents, validate AI-extracted data, and help build the trusted ground truth dataset.</p>
              <p className="login-prompt">Login to your account !</p>
            </div>

            <div className="login-form-container">
              {error && (
                <div className="error-message">
                  <span>⚠️</span>
                  {error}
                </div>
              )}
              
              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <input 
                    type="email" 
                    className="form-input" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email@gmail.com"
                    required
                  />
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

                <div className="form-options">
                  <label className="remember-me">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    Remember me
                  </label>
                  <a href="#" className="forgot-password">Forgot Password?</a>
                </div>

                <button 
                  type="submit" 
                  className="signin-btn"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
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

              <div className="signup-link">
                <span>Don't you have an account? </span>
                <a href="#" onClick={() => navigate('/registration')}>Sign up</a>
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

export default Login;