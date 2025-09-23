import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaBars, FaChevronDown, FaChevronRight, FaHome, FaCheckCircle, FaFileAlt, FaUpload, FaCog, FaTachometerAlt, FaFileUpload, FaUsers } from 'react-icons/fa';
import config from '../config.js';

const SideNavbar = ({ isSidebarOpen, toggleSidebar }) => {
  console.log('SideNavbar rendering, isSidebarOpen:', isSidebarOpen);
  const sidebarRef = useRef(null);
  const location = useLocation();
  const [userPermissions, setUserPermissions] = useState([]);
  const [expandedMenus, setExpandedMenus] = useState({
    admin: false,
    'data-validation': false,
    'bulk-upload': true  // Default expand bulk upload to match screenshot
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
    if (currentPath.includes('/admin')) {
      setExpandedMenus(prev => ({ ...prev, admin: true }));
    } else if (currentPath.includes('/data-validation')) {
      setExpandedMenus(prev => ({ ...prev, 'data-validation': true }));
    }
  }, [currentPath]);

  // Collapse sidebar on click outside or Escape key

  useEffect(() => {
    if (!isSidebarOpen) return;

    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        toggleSidebar();
      }
    };

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        toggleSidebar();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isSidebarOpen, toggleSidebar]);

  return (
    <>
      {/* Hamburger icon for collapse/expand, only show when sidebar is closed */}
      {!isSidebarOpen && (
        <div className="menu-btn" style={{ position: 'fixed', top: 85, left: 0, zIndex: 1000, width: '50px', height: '100%', backgroundColor: '#031d39', borderRadius: '0px' }}>
          <button
            className="btn btn-dark menu-btn"
            style={{background: 'transparent'}}
            onClick={toggleSidebar}>
            <FaBars />
          </button>
        </div>
      )}
      
      {/* Sidebar */}
      {isSidebarOpen && (
        <div
          ref={sidebarRef}
          className="text-white pt-3 sideNavbar navbar-open"
          style={{ width: '280px', position: 'fixed', top: 93, left: 0, backgroundColor: '#031d39', minHeight: '100vh', zIndex: 1100 }}
        >
          {/* Sidebar Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 px-3">
            <h5>{currentPath.split('/')[1] ? currentPath.split('/')[1].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Menu'}</h5>
            <FaBars onClick={toggleSidebar} style={{ cursor: 'pointer' }} />
          </div>
          
          {/* Navigation Menu */}
          <nav className="flex-column px-2">
            {/* Home */}
            {hasPermission('home') && (
              <NavLink to="/home" className={`nav-link text-white py-2 ${isActive('/home') ? 'active' : ''}`}>
                <FaHome className="me-3" /> Home
              </NavLink>
            )}
            
            {/* Data Validation */}
            {hasPermission('dataValidation') && (
              <div>
                <div onClick={() => toggleMenu('data-validation')} className={`nav-link text-white py-2 d-flex justify-content-between align-items-center ${isActive('/data-validation') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                  <div>
                    <FaCheckCircle className="me-3" /> Data Validation
                  </div>
                  {expandedMenus['data-validation'] ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                </div>
                
                {expandedMenus['data-validation'] && (
                  <div className="ms-4">
                    <NavLink to="/data-validation/about-cag" className={`nav-link text-white py-2 ${currentPath.includes('/data-validation/about-cag') ? 'active' : ''}`}>
                      <FaCheckCircle className="me-2" /> About CAG
                    </NavLink>
                    <NavLink to="/data-validation/validation" className={`nav-link text-white py-2 ${currentPath.includes('/data-validation/validation') ? 'active' : ''}`}>
                      <FaCheckCircle className="me-2" /> Validation
                    </NavLink>
                  </div>
                )}
              </div>
            )}
            
            {/* Assigned Documents */}
            {hasPermission('assignedDocuments') && (
              <NavLink to="/assigned-documents" className={`nav-link text-white py-2 ${isActive('/assigned-documents') ? 'active' : ''}`}>
                <FaFileAlt className="me-3" /> Assigned Documents
              </NavLink>
            )}
            
            {/* Bulk Upload with submenus */}
            {hasPermission('bulkUpload') && (
              <div>
                <div onClick={() => toggleMenu('bulk-upload')} className={`nav-link text-white py-2 d-flex justify-content-between align-items-center ${isActive('/bulk-upload') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                  <div>
                    <FaUpload className="me-3" /> Bulk Upload
                  </div>
                  {expandedMenus['bulk-upload'] ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                </div>
                
                {expandedMenus['bulk-upload'] && (
                  <div className="ms-4">
                    <NavLink to="/bulk-upload" end className={`nav-link text-white py-2 ${currentPath === '/bulk-upload' ? 'active' : ''}`}>
                      <FaTachometerAlt className="me-2" /> Dashboard
                    </NavLink>
                    <NavLink to="/bulk-upload/upload" className={`nav-link text-white py-2 ${currentPath.includes('/bulk-upload/upload') ? 'active' : ''}`}>
                      <FaFileUpload className="me-2" /> Add Document
                    </NavLink>
                    <NavLink to="/bulk-upload/view-files" className={`nav-link text-white py-2 ${currentPath.includes('/bulk-upload/view-files') ? 'active' : ''}`}>
                      <FaUsers className="me-2" /> Assign Document
                    </NavLink>
                  </div>
                )}
              </div>
            )}
            
            {/* Admin with submenus */}
            {hasPermission('admin') && (
              <div>
                <div onClick={() => toggleMenu('admin')} className={`nav-link text-white py-2 d-flex justify-content-between align-items-center ${isActive('/admin') ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                  <div>
                    <FaCog className="me-3" /> Admin
                  </div>
                  {expandedMenus.admin ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                </div>
                
                {expandedMenus.admin && (
                  <div className="ms-4">
                    <NavLink to="/admin/menus" className={`nav-link text-white py-2 ${currentPath.includes('/admin/menus') ? 'active' : ''}`}>
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
