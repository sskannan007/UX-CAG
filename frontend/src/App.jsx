import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import TopNavbar from './components/TopNavbar';
import SideNavbar from './components/SideNavbar';
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import BulkUploadViewer from './pages/BulkUploadViewer';
import './App.css';

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userConfig, setUserConfig] = useState({});
  const [loading, setLoading] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Simple auth check - you can replace this with your actual auth logic
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Set some basic user config for demonstration
      setUserConfig({
        bulkUpload: true,
        home: true,
        dataValidation: true,
        assignedDocuments: true,
        admin: false
      });
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const ProtectedRoute = ({ children, requiredRole }) => {
    const token = localStorage.getItem('token');
    
    // If no token, redirect to login
    if (!token) {
      return <Navigate to="/login" replace />;
    }
    
    // If no required role specified, allow access
    if (!requiredRole) {
      return children;
    }
    
    // Check if user has the specific permission
    if (!userConfig?.[requiredRole]) {
      return (
        <div className="container mt-5">
          <div className="alert alert-danger text-center">
            <h4>Access Denied</h4>
            <p>You don't have permission to access this page.</p>
            <p>Please contact your administrator.</p>
          </div>
        </div>
      );
    }
    
    return children;
  };

  const LayoutWithSidebar = ({ children }) => {
    return (
      <>
        <TopNavbar />
        <SideNavbar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        <div style={{ marginLeft: isSidebarOpen ? '280px' : '50px', transition: 'margin-left 0.3s ease', marginTop: '80px' }}>
          {children}
        </div>
      </>
    );
  };

  // Simple login page component
  const SimpleLogin = () => {
    const [email, setEmail] = useState('demo@example.com');
    const [password, setPassword] = useState('password');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');

      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simple validation
        if (!email || !password) {
          setError('Please enter both email and password');
          return;
        }

        // For demo purposes, accept any email/password combination
        // In production, you would make an API call to validate credentials
        localStorage.setItem('token', 'demo-token');
        
        // Update user config
        setUserConfig({
          bulkUpload: true,
          home: true,
          dataValidation: true,
          assignedDocuments: true,
          admin: true
        });
        
        // Navigate to home page
        window.location.href = '/home';
        
      } catch (err) {
        setError('Login failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card shadow">
              <div className="card-header bg-primary text-white">
                <h3 className="text-center mb-0">
                  <i className="fas fa-lock me-2"></i>
                  Login to PROOF BOX
                </h3>
              </div>
              <div className="card-body p-4">
                {error && (
                  <div className="alert alert-danger" role="alert">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    {error}
                  </div>
                )}
                
                <form onSubmit={handleLogin}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-envelope me-2"></i>
                      Email Address
                    </label>
                    <input 
                      type="email" 
                      className="form-control" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-key me-2"></i>
                      Password
                    </label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-primary w-100"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Logging in...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-sign-in-alt me-2"></i>
                        Login
                      </>
                    )}
                  </button>
                </form>
                
                <div className="mt-3 text-center">
                  <small className="text-muted">
                    Demo credentials: demo@example.com / password
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<SimpleLogin />} />
        <Route path="/login" element={<SimpleLogin />} />
        <Route path="/home" element={
          <ProtectedRoute requiredRole="home">
            <LayoutWithSidebar>
              <Home />
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
        <Route path="/about" element={
          <ProtectedRoute>
            <LayoutWithSidebar>
              <About />
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
        <Route path="/contact" element={
          <ProtectedRoute>
            <LayoutWithSidebar>
              <Contact />
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
        <Route path="/bulk-upload" element={
          <ProtectedRoute requiredRole="bulkUpload">
            <LayoutWithSidebar>
              <BulkUploadViewer />
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
        <Route path="/bulk-upload/upload" element={
          <ProtectedRoute requiredRole="bulkUpload">
            <LayoutWithSidebar>
              <BulkUploadViewer />
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
        <Route path="/bulk-upload/view-files" element={
          <ProtectedRoute requiredRole="bulkUpload">
            <LayoutWithSidebar>
              <BulkUploadViewer />
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
        <Route path="/data-validation" element={
          <ProtectedRoute requiredRole="dataValidation">
            <LayoutWithSidebar>
              <div className="container mt-5">
                <h1>Data Validation</h1>
                <p>This is a placeholder data validation page.</p>
      </div>
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
        <Route path="/assigned-documents" element={
          <ProtectedRoute requiredRole="assignedDocuments">
            <LayoutWithSidebar>
              <div className="container mt-5">
                <h1>Assigned Documents</h1>
                <p>This is a placeholder assigned documents page.</p>
      </div>
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
