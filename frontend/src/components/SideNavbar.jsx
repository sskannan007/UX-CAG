import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaChevronDown, FaChevronRight, FaHome, FaCheckCircle, FaFileAlt, FaCog, FaTachometerAlt, FaUsers } from 'react-icons/fa';
import config from '../config.js';

const SideNavbar = ({ isSidebarOpen }) => {
  console.log('SideNavbar rendering, isSidebarOpen:', isSidebarOpen);
  const sidebarRef = useRef(null);
  const location = useLocation();
  const [userPermissions, setUserPermissions] = useState([]);
  const [expandedMenus, setExpandedMenus] = useState({
    admin: false
  });
  const [userConfig, setUserConfig] = useState({
    // Default permissions for demo purposes
    home: true,
    dataValidation: true,
    assignedDocuments: true,
    bulkUpload: true,
    admin: true
  });
  const [userRole, setUserRole] = useState(null);

  // Fetch user permissions on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${config.BASE_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => response.json())
      .then(data => {
        setUserPermissions(data.permissions || []);
        setUserConfig(data.config || {});
        setUserRole(data.role || null);
      })
      .catch(error => {
        console.error('Error fetching user permissions:', error);
      });
    }
  }, []);

  // Check if user has permission
  const hasPermission = (role) => {
    if (!role) return true;
    
    // Check in userConfig
    if (userConfig?.[role]) return true;
    
    // Check in permissions array
    const flatPerms = Array.isArray(userPermissions)
      ? userPermissions.map(p => (typeof p === 'string' ? p : `${p?.menu_name}:${p?.action || 'view'}`))
      : [];
    
    return flatPerms.includes(`${role}:view`);
  };

  // Get current page from location
  const currentPath = location.pathname;
  const isActive = (path) => {
    if (path === '/home') {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  // Toggle menu expansion
  const toggleMenu = (menuType) => {
    console.log(`Toggling menu: ${menuType}`);
    setExpandedMenus(prev => ({
      ...prev,
      [menuType]: !prev[menuType]
    }));
  };

  // Check current paths and expand menus accordingly
  useEffect(() => {
    if (currentPath.includes('/admin') || currentPath.includes('/user-management') || currentPath.includes('/create-user') || currentPath.includes('/bulk-upload-users')) {
      setExpandedMenus(prev => ({ ...prev, admin: true }));
    }
  }, [currentPath]);

  // Sidebar is always open, no collapse functionality needed

  return (
    <>
      {/* Sidebar - always visible */}
      {isSidebarOpen && (
        <div
          ref={sidebarRef}
          className="pt-3 sideNavbar navbar-open"
          style={{ width: '280px', position: 'fixed', top: 80, left: 0, backgroundColor: '#fff', minHeight: '100vh', zIndex: 1100, color: '#161616' }}
        >
          {/* Sidebar Header */}
          {/* <div className="d-flex justify-content-between align-items-center mb-4 px-3">
            <h5>{currentPath.split('/')[1] ? currentPath.split('/')[1].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Menu'}</h5>
          </div> */}
          
          {/* Navigation Menu */}
          <nav className="flex-column sidebar-style">
            {/* Home */}
            {hasPermission('home') && (
              <NavLink to="/home" className={`nav-link ${isActive('/home') ? 'active' : ''}`} style={{ color: isActive('/home') ? '#161616' : '#828282' }}>
                <FaHome className="me-3" /> Home
              </NavLink>
            )}
            
            {/* Data Validation */}
            {hasPermission('dataValidation') && (
              <NavLink to="/data-validation" className={`nav-link ${isActive('/data-validation') ? 'active' : ''}`} style={{ color: isActive('/data-validation') ? '#161616' : '#828282' }}>
                <FaCheckCircle className="me-3" /> Data Validation
              </NavLink>
            )}
            
            {/* Assigned Documents */}
            {hasPermission('assignedDocuments') && (
              <NavLink to="/assigned-documents" className={`nav-link ${isActive('/assigned-documents') ? 'active' : ''}`} style={{ color: isActive('/assigned-documents') ? '#161616' : '#828282' }}>
                <FaFileAlt className="me-3" /> Assigned Documents
              </NavLink>
            )}
            
            {/* Dashboard */}
            {hasPermission('bulkUpload') && (
              <NavLink to="/bulk-upload" className={`nav-link ${isActive('/bulk-upload') ? 'active' : ''}`} style={{ color: isActive('/bulk-upload') ? '#161616' : '#828282' }}>
                <FaTachometerAlt className="me-3" /> Dashboard
              </NavLink>
            )}
            
            {/* Admin with submenus */}
            {hasPermission('admin') && (
              <div>
                <div onClick={() => toggleMenu('admin')} className={`nav-link d-flex justify-content-between align-items-center ${(isActive('/admin') || isActive('/user-management')) ? 'active' : ''}`} style={{ cursor: 'pointer', color: (isActive('/admin') || isActive('/user-management')) ? '#161616' : '#828282' }}>
                  <div>
                    <FaCog className="me-3" /> Admin
                  </div>
                  {expandedMenus.admin ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                </div>
                
                {expandedMenus.admin && (
                  <div className="ms-4">
                    <NavLink to="/user-management" className={`nav-link ${currentPath.includes('/user-management') ? 'active' : ''}`} style={{ color: currentPath.includes('/user-management') ? '#161616' : '#828282' }}>
                      <FaUsers className="me-2" /> User Management
                    </NavLink>
                    {/* Add other admin submenus as needed */}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
};

export default SideNavbar;
