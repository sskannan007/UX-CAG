import config from '../config.js'; //add utils

// Utility function to handle API requests with automatic error handling
export const apiRequest = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      console.log('Token expired or invalid, redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user_data');
      window.location.href = '/login';
      throw new Error('Authentication failed. Please log in again.');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Utility function to check if user is authenticated
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  return !!token;
};

// Utility function to get current user data
export const getCurrentUser = () => {
  const userData = localStorage.getItem('user_data');
  return userData ? JSON.parse(userData) : null;
};

// Utility function to logout
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user_data');
  window.location.href = '/login';
};
