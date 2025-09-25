import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import TopNavbar from './components/TopNavbar';
import SideNavbar from './components/SideNavbar';
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import BulkUploadViewer from './pages/BulkUploadViewer';
import Login from './pages/Login';
import Registration from './pages/Registration';
import UserManagement from './pages/UserManagement';
import DataValidationPage from './pages/DataValidationPage';
import './App.css';
import Chatbot from './pages/Chatbot';
import AssignedDocuments from './pages/AssignedDocuments';

function AppContent() {
  const [isSidebarOpen] = useState(true); // Always keep sidebar open
  const [userConfig, setUserConfig] = useState({});
  const [loading, setLoading] = useState(false);

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
        admin: true
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
        <SideNavbar isSidebarOpen={isSidebarOpen} />
        <div style={{ marginLeft: '280px', marginTop: '92px' }}>
          {children}
        </div>
      </>
    );
  };

  // Simple login page component has been moved to ./pages/Login.jsx

  return (
    <>
      <Routes>
        <Route path="/" element={<Login setUserConfig={setUserConfig} />} />
        <Route path="/login" element={<Login setUserConfig={setUserConfig} />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/dashboard" element={
          <ProtectedRoute requiredRole="home">
            <LayoutWithSidebar>
              <Home />
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
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
            <DataValidationPage />
          </ProtectedRoute>
        } />
        <Route path="/assigned-documents" element={
          <ProtectedRoute requiredRole="assignedDocuments">
            <LayoutWithSidebar>
              <AssignedDocuments />
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
        <Route path="/admin/menus" element={
          <ProtectedRoute requiredRole="admin">
            <LayoutWithSidebar>
              <UserManagement />
            </LayoutWithSidebar>
          </ProtectedRoute>
        } />
          <Route path="/chatbot" element={
          <ProtectedRoute>
            <Chatbot />
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
