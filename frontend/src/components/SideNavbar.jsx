import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import config from '../config.js';

const SideNavbar = ({ isSidebarOpen, toggleSidebar }) => {
  const sidebarRef = useRef(null);
  const location = useLocation();
  const [userPermissions, setUserPermissions] = useState([]);
  const [userConfig, setUserConfig] = useState({});
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

  // Get current page type based on location
  const getCurrentPageType = () => {
    const path = location.pathname;
    if (path.includes('/admin')) {
      return 'admin';
    } else if (path.includes('/data-validation')) {
      return 'data-validation';
    } else if (path.includes('/bulk-upload')) {
      return 'bulk-upload';
    } else if (path.includes('/assigned-documents')) {
      return 'assigned-documents';
    } else if (path.includes('/home')) {
      return 'home';
    }
    return 'default';
  };

  // Generate menu items based on current page and user permissions
  const generateMenuItems = () => {
    const items = [];
    const pageType = getCurrentPageType();

    // Main navigation items for all pages
    const mainNavItems = [
      { path: '/home', label: 'Home', icon: 'fas fa-home', requiredRole: 'home' },
      { path: '/data-validation', label: 'Data Validation', icon: 'fas fa-check-circle', requiredRole: 'dataValidation' },
      { path: '/assigned-documents', label: 'Assigned Documents', icon: 'fas fa-file-check', requiredRole: 'assignedDocuments' },
      { path: '/bulk-upload', label: 'Bulk Upload', icon: 'fas fa-upload', requiredRole: 'bulkUpload' },
      { path: '/admin', label: 'Admin', icon: 'fas fa-cog', requiredRole: 'admin' }
    ];

    // Filter items based on user permissions
    const flatPerms = Array.isArray(userPermissions)
      ? userPermissions.map(p => (typeof p === 'string' ? p : `${p?.menu_name}:${p?.action || 'view'}`))
      : [];

    mainNavItems.forEach(item => {
      // Check if user has the required role/permission
      const hasPermission = !item.requiredRole || userConfig?.[item.requiredRole] || flatPerms.includes(`${item.requiredRole}:view`);
      
      if (hasPermission) {
        items.push({
          path: item.path,
          label: item.label,
          icon: item.icon,
          end: true
        });
      }
    });

    // Add admin submenus if on admin page
    if (pageType === 'admin') {
      const adminSubmenus = [
        { path: '/admin/rolecreation', label: 'Role Creation', perm: 'role_creation:view' },
        { path: '/admin/menuscreation', label: 'Menu Creation', perm: 'menu_creation:view' },
        { path: '/admin/roles', label: 'Roles Management', perm: 'role_management:view' },
        { path: '/admin/menus', label: 'User Management', perm: 'user_management:view' },
        { path: '/admin/existingmenus', label: 'Existing Menus', perm: 'existing_menus:view' },
        { path: '/admin/audit-logs', label: 'Audit Logs', perm: 'audit_logs:view' },
        { path: '/admin/inspection-period', label: 'Inspection Period', perm: 'inspection_period:view' },
        { path: '/admin/feedback-management', label: 'Feedback Management', perm: 'feedback:view' }
      ];
      
      adminSubmenus.forEach(submenu => {
        if (Array.isArray(flatPerms) && flatPerms.includes(submenu.perm)) {
          items.push({
            path: submenu.path,
            label: submenu.label,
            icon: 'fas fa-circle',
            end: false
          });
        }
      });
    }

    // Add bulk upload submenus if on bulk upload page
    else if (pageType === 'bulk-upload') {
      const bulkUploadSubmenus = [
        { path: '/bulk-upload', label: 'Dashboard', icon: 'fas fa-home' },
        { path: '/bulk-upload/upload', label: 'Add Document', icon: 'fas fa-upload' },
        { path: '/bulk-upload/view-files', label: 'Assign Document', icon: 'fas fa-user-plus' }
      ];

      bulkUploadSubmenus.forEach(submenu => {
        items.push({
          path: submenu.path,
          label: submenu.label,
          icon: submenu.icon,
          end: false
        });
      });
    }

    // Add data validation submenus if on data validation page
    else if (pageType === 'data-validation') {
      const validationSubmenus = [
        { path: '/data-validation/about-cag', label: 'About CAG', icon: 'fas fa-circle' },
        { path: '/data-validation/validation', label: 'Validation', icon: 'fas fa-circle' }
      ];

      validationSubmenus.forEach(submenu => {
        items.push({
          path: submenu.path,
          label: submenu.label,
          icon: submenu.icon,
          end: false
        });
      });
    }

    return items;
  };

  const menuItems = generateMenuItems();

  // Determine heading based on current page
  const getHeading = () => {
    const pageType = getCurrentPageType();
    switch (pageType) {
      case 'admin':
        return 'Admin Panel';
      case 'data-validation':
        return 'Data Validation';
      case 'bulk-upload':
        return 'Bulk Upload';
      case 'assigned-documents':
        return 'Assigned Documents';
      case 'home':
        return 'Home';
      default:
        return 'Menu';
    }
  };

  // Collapse sidebar on click outside or Escape key
  const pageTypeForEffects = getCurrentPageType();

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
  }, [isSidebarOpen, toggleSidebar, pageTypeForEffects]);

  // On Admin routes, force the sidebar to start open and stay open unless hamburger is clicked
  useEffect(() => {
    if (getCurrentPageType() === 'admin') {
      // Ensure open on mount
      if (!isSidebarOpen) {
        toggleSidebar();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          className="text-white pt-3 sideNavbar navbar-open "
          style={{ width: '280px', position: 'fixed', top: 93, left: 0, backgroundColor: '#031d39', minHeight: '100vh', zIndex: 1100 }}
        >
          <div className="d-flex justify-content-between align-items-center mb-4 px-3">
            <h5>{getHeading()}</h5>
            <FaBars onClick={toggleSidebar} style={{ cursor: 'pointer' }} />
          </div>
          <nav className="flex-column">
            {menuItems.length > 0 ? (
              menuItems.map((item, index) => (
                <NavLink
                  key={index}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => {
                    const currentPath = location.pathname;
                    const isUsersItem = item.path === '/admin';
                    const usersActive = isUsersItem && (currentPath === '/admin' || currentPath.startsWith('/admin/users'));
                    const active = isUsersItem ? usersActive : isActive;
                    return `nav-link text-white mb-3 d-flex align-items-center${active ? ' active' : ''}`;
                  }}>
                  <i className={`${item.icon} me-2`}></i>
                  {item.label}
                </NavLink>
              ))
            ) : (
              <div className="text-white-50 small">
                {/* No menu items available */}
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
};

export default SideNavbar;
