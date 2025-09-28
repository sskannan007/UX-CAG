import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Alert, Spinner, Tabs, Tab } from 'react-bootstrap';
import axios from 'axios';
import config from '../config.js';
import TopNavbar from '../components/TopNavbar';
import SideNavbar from '../components/SideNavbar';

const UnifiedAdminManagement = () => {
  // Common state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('roleManagement');

  // Role Creation State
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    permissions: {
      all: false,
      create: false,
      delete: false,
      update: false,
      view: false
    }
  });

  const [menus, setMenus] = useState([]);

  // Role Management State
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedMenu, setSelectedMenu] = useState('');
  const [rolePermissions, setRolePermissions] = useState({});
  
  // New UX State
  const [roleName, setRoleName] = useState('Admin');
  const [roleType, setRoleType] = useState('DD Standard/Custom');
  const [roleDescription, setRoleDescription] = useState('');
  const [roleStatus, setRoleStatus] = useState(true);
  const [searchFeature, setSearchFeature] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState([
    'Role Details',
    'User Role Management'
  ]);
  const [userRolePermissions, setUserRolePermissions] = useState({
    'Create/Edit Membership Users': { create: false, view: false, update: false, delete: false },
    'Assign Roles (Admin, Validator)': { create: false, view: false, update: false, delete: false },
    'Manage Roles': { create: false, view: false, update: false, delete: false },
    'Manage Permissions': { create: false, view: false, update: false, delete: false }
  });


  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch users
      const usersResponse = await axios.get(`${config.BASE_URL}/admin/users/list`);
      setUsers(usersResponse.data);

      // Fetch roles
      try {
        const rolesResponse = await axios.get(`${config.BASE_URL}/api/roles`);
        setRoles(rolesResponse.data.roles || []);
      } catch (roleError) {
        console.log('Roles API not available');
        setRoles([]);
      }

      // Fetch menus
      try {
        const menusResponse = await axios.get(`${config.BASE_URL}/admin/menus/list`);
        setMenus(menusResponse.data || []);
      } catch (menuError) {
        console.log('Menus API not available');
        setMenus([]);
      }

    } catch (err) {
      setError('Failed to fetch data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Role Creation Handlers
  const handleRoleInputChange = (e) => {
    const { name, value } = e.target;
    setRoleFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRoleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    
    if (name === 'all') {
      setRoleFormData(prev => ({
        ...prev,
        permissions: {
          all: checked,
          create: checked,
          delete: checked,
          update: checked,
          view: checked
        }
      }));
    } else {
      setRoleFormData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [name]: checked,
          all: name !== 'all' && !checked ? false : 
               (prev.permissions.create && prev.permissions.delete && 
                prev.permissions.update && prev.permissions.view && checked)
        }
      }));
    }
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const permissions = {};
      const commonMenus = ['home', 'about', 'feedback', 'data_validation', 'bulk_upload', 'admin', 'role_creation', 'menu_creation', 'role_management', 'existing_menus', 'users', 'user_management', 'audit_logs', 'assign_menus'];
      
      if (roleFormData.permissions.all) {
        commonMenus.forEach(menu => {
          permissions[menu] = {
            view: true,
            create: true,
            update: true,
            delete: true
          };
        });
      } else {
        commonMenus.forEach(menu => {
          permissions[menu] = {
            view: roleFormData.permissions.view,
            create: roleFormData.permissions.create,
            update: roleFormData.permissions.update,
            delete: roleFormData.permissions.delete
          };
        });
      }
      
      const roleData = {
        name: roleFormData.name.trim(),
        description: roleFormData.description.trim() || null,
        permissions: permissions
      };
      
      await axios.post(`${config.BASE_URL}/admin/roles/create`, roleData, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      setSuccess('Role created successfully!');
      
      // Reset form
      setRoleFormData({
        name: '',
        description: '',
        permissions: {
          all: false,
          create: false,
          delete: false,
          update: false,
          view: false
        }
      });

      // Refresh data
      fetchAllData();
    } catch (err) {
      let errorMessage = 'Failed to create role';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };


  // Role Management Handlers
  const handleRoleSelection = (roleName) => {
    setSelectedRole(roleName);
    
    if (roleName) {
      const selectedRoleData = roles.find(role => role.name === roleName);
      if (selectedRoleData && selectedRoleData.configuration) {
        const merged = {};
        if (Array.isArray(menus) && menus.length > 0) {
          menus.forEach(menu => {
            merged[menu.name] = selectedRoleData.configuration[menu.name] || { view: false, create: false, update: false, delete: false };
          });
        } else {
          Object.assign(merged, selectedRoleData.configuration);
        }
        setRolePermissions(merged);
      } else {
        const defaultPermissions = {};
        menus.forEach(menu => {
          defaultPermissions[menu.name] = { view: false, create: false, update: false, delete: false };
        });
        setRolePermissions(defaultPermissions);
      }
    } else {
      setRolePermissions({});
    }
  };

  const handlePermissionChange = (menuName, permission, checked) => {
    setRolePermissions(prev => ({
      ...prev,
      [menuName]: {
        ...prev[menuName],
        [permission]: checked
      }
    }));
  };

  const handleAllPermissionChange = (menuName, checked) => {
    setRolePermissions(prev => ({
      ...prev,
      [menuName]: {
        view: checked,
        create: checked,
        update: checked,
        delete: checked
      }
    }));
  };

  const handleUpdatePermission = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (selectedRole) {
        const roleObj = roles.find(r => r.name === selectedRole);
        const description = roleObj && roleObj.description ? roleObj.description : '';
        await axios.post(`${config.BASE_URL}/admin/roles/update`, {
          name: selectedRole,
          description,
          permissions: rolePermissions
        });
      }
      
      if (selectedUser && selectedRole) {
        const userObj = users.find(u => Number(u.id) === Number(selectedUser));
        const roleObj = roles.find(r => r.name === selectedRole);
        if (userObj && roleObj) {
          await axios.post(`${config.BASE_URL}/api/assign-role`, {
            user_id: userObj.id,
            role_id: roleObj.id
          });
          
          setUsers(prev => prev.map(u => u.id === userObj.id ? { ...u, role_status: 'assigned' } : u));

          const cfg = {
            home: !!(rolePermissions?.home?.view),
            about: !!(rolePermissions?.about?.view),
            feedback: !!(rolePermissions?.feedback?.view),
            data_validation: !!(rolePermissions?.data_validation?.view),
            bulkUpload: !!(rolePermissions?.bulk_upload?.view || rolePermissions?.bulkUpload?.view),
            admin: !!(rolePermissions?.admin?.view),
            users: !!(rolePermissions?.users?.view),
            user_management: !!(rolePermissions?.user_management?.view),
            audit_logs: !!(rolePermissions?.audit_logs?.view),
            assigned_documents: !!(rolePermissions?.assigned_documents?.view)
          };

          try {
            await axios.put(`${config.BASE_URL}/admin/users/${userObj.id}/config`, cfg, {
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (e) {
            console.warn('Failed to update user config for routing access:', e?.response?.data || e.message);
          }
        }
      }
      setSuccess('Permissions updated successfully!');
      fetchAllData();
    } catch (err) {
      setError('Failed to update permissions: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // New UX Handlers
  const handleFeatureToggle = (feature) => {
    setSelectedFeatures(prev => 
      prev.includes(feature) 
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const handleUserRolePermissionChange = (feature, permission, checked) => {
    setUserRolePermissions(prev => ({
      ...prev,
      [feature]: {
        ...prev[feature],
        [permission]: checked
      }
    }));
  };

  const handleAllUserRolePermissions = (feature, checked) => {
    setUserRolePermissions(prev => ({
      ...prev,
      [feature]: {
        create: checked,
        view: checked,
        update: checked,
        delete: checked
      }
    }));
  };

  return (
    <>
      <TopNavbar />
      <div style={{ marginTop: '85px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        <div className={isSidebarOpen ? 'navbar-open' : ''}>
          <SideNavbar isSidebarOpen={isSidebarOpen} />
          <Container fluid className="p-4 close-navbar-additional" style={{ marginLeft: isSidebarOpen ? '280px' : '0', transition: 'margin-left 0.3s' }}>
            
            {/* Breadcrumbs */}
            <nav aria-label="breadcrumb" className="mb-3">
              <ol className="breadcrumb">
                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                <li className="breadcrumb-item"><a href="#">Settings & Configurations</a></li>
                <li className="breadcrumb-item active" aria-current="page">New Role</li>
              </ol>
            </nav>

            {/* Header with Role Selection */}
            <Row className="mb-4">
              <Col>
                <Card className="shadow-sm border-0 bg-white">
                  <Card.Body className="py-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-4">
                        <h4 className="mb-0 text-dark">New Role</h4>
                        <div className="d-flex gap-3">
                          <Form.Check
                            type="radio"
                            id="newRole"
                            name="roleType"
                            label="New Role"
                            checked={true}
                            className="mb-0"
                          />
                          <Form.Check
                            type="radio"
                            id="allAssignedRoles"
                            name="roleType"
                            label="All Assigned roles"
                            className="mb-0"
                          />
                        </div>
                      </div>
                      <Button variant="outline-primary" className="d-flex align-items-center gap-2">
                        <i className="fas fa-cog"></i>
                        Assign to users
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Status Alerts */}
            {error && (
              <Alert variant="danger" onClose={() => setError(null)} dismissible>
                {error}
              </Alert>
            )}
            
            {success && (
              <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
                {success}
              </Alert>
            )}

            {/* Three Column Layout */}
            <Row>
              {/* Left Column - Features Category */}
              <Col md={3}>
                <Card className="shadow-sm border-0 bg-white h-100">
                  <Card.Header className="bg-light">
                    <h6 className="mb-0">Features Category</h6>
                  </Card.Header>
                  <Card.Body>
                    <Form.Group className="mb-3">
                      <Form.Control
                        type="text"
                        placeholder="Search feature"
                        value={searchFeature}
                        onChange={(e) => setSearchFeature(e.target.value)}
                        className="mb-3"
                      />
                    </Form.Group>
                    
                    <div className="feature-list">
                      {[
                        'Role Details',
                        'User Role Management'
                      ]
                      .filter(feature => 
                        feature.toLowerCase().includes(searchFeature.toLowerCase())
                      )
                      .map(feature => (
                        <div key={feature} className="mb-2">
                          <Form.Check
                            type="checkbox"
                            id={feature}
                            label={feature}
                            checked={selectedFeatures.includes(feature)}
                            onChange={() => handleFeatureToggle(feature)}
                            className="feature-checkbox"
                          />
                        </div>
                      ))}
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Middle Column - Role Details and Permissions */}
              <Col md={6}>
                <Card className="shadow-sm border-0 bg-white h-100">
                  <Card.Body>
                    {/* Role Details - Only show if selected */}
                    {selectedFeatures.includes('Role Details') && (
                      <div className="mb-4">
                        <h6 className="mb-3">Role Details</h6>
                        <Card className="border">
                          <Card.Body>
                            <Form.Group className="mb-3">
                              <Form.Label>Role Name</Form.Label>
                              <Form.Control
                                type="text"
                                value={roleName}
                                onChange={(e) => setRoleName(e.target.value)}
                                placeholder="Enter role name"
                              />
                            </Form.Group>
                            
                            <Form.Group className="mb-3">
                              <Form.Label>Description</Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={3}
                                value={roleDescription}
                                onChange={(e) => setRoleDescription(e.target.value)}
                                placeholder="Enter description (optional)"
                              />
                            </Form.Group>
                            
                            <Form.Group className="mb-3">
                              <Form.Label>Permissions</Form.Label>
                              <Row>
                                <Col md={6}>
                                  <Form.Check
                                    type="checkbox"
                                    id="all"
                                    label="All"
                                    name="all"
                                    checked={roleFormData.permissions.all}
                                    onChange={handleRoleCheckboxChange}
                                    className="mb-2"
                                  />
                                  <Form.Check
                                    type="checkbox"
                                    id="create"
                                    label="Create"
                                    name="create"
                                    checked={roleFormData.permissions.create}
                                    onChange={handleRoleCheckboxChange}
                                    className="mb-2"
                                  />
                                </Col>
                                <Col md={6}>
                                  <Form.Check
                                    type="checkbox"
                                    id="delete"
                                    label="Delete"
                                    name="delete"
                                    checked={roleFormData.permissions.delete}
                                    onChange={handleRoleCheckboxChange}
                                    className="mb-2"
                                  />
                                  <Form.Check
                                    type="checkbox"
                                    id="update"
                                    label="Update"
                                    name="update"
                                    checked={roleFormData.permissions.update}
                                    onChange={handleRoleCheckboxChange}
                                    className="mb-2"
                                  />
                                  <Form.Check
                                    type="checkbox"
                                    id="view"
                                    label="View"
                                    name="view"
                                    checked={roleFormData.permissions.view}
                                    onChange={handleRoleCheckboxChange}
                                    className="mb-2"
                                  />
                                </Col>
                              </Row>
                            </Form.Group>
                            
                            <div className="d-flex justify-content-end">
                              <Button variant="primary" onClick={handleRoleSubmit} disabled={loading}>
                                {loading ? 'Creating...' : 'Create Role'}
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>
                      </div>
                    )}

                    {/* User Role Management - Only show if selected */}
                    {selectedFeatures.includes('User Role Management') && (
                      <div className="mb-4">
                        <h6 className="mb-3">User Role Management</h6>
                        <Card className="border">
                          <Card.Body>
                            <Row>
                              <Col md={4}>
                                <Form.Group className="mb-3">
                                  <Form.Label><strong>Select User</strong></Form.Label>
                                  <Form.Select 
                                    value={selectedUser} 
                                    onChange={(e) => setSelectedUser(Number(e.target.value))}
                                    disabled={loading}
                                  >
                                    <option value="">Choose a user...</option>
                                    {users.map(user => (
                                      <option key={user.id} value={user.id}>
                                        {user.name} ({user.email})
                                      </option>
                                    ))}
                                  </Form.Select>
                                </Form.Group>
                              </Col>
                              
                              <Col md={4}>
                                <Form.Group className="mb-3">
                                  <Form.Label><strong>Select Role</strong></Form.Label>
                                  <Form.Select 
                                    value={selectedRole} 
                                    onChange={(e) => handleRoleSelection(e.target.value)}
                                    disabled={loading}
                                  >
                                    <option value="">Choose a role...</option>
                                    {roles.map(role => (
                                      <option key={role.id || role.name} value={role.name}>
                                        {role.name} {role.description ? `- ${role.description}` : ''}
                                      </option>
                                    ))}
                                  </Form.Select>
                                </Form.Group>
                              </Col>

                              <Col md={4}>
                                <Form.Group className="mb-3">
                                  <Form.Label><strong>Select Menu</strong></Form.Label>
                                  <Form.Select 
                                    value={selectedMenu} 
                                    onChange={(e) => setSelectedMenu(e.target.value)}
                                    disabled={loading}
                                  >
                                    <option value="">All menus...</option>
                                    {menus.map(menu => (
                                      <option key={menu.id} value={menu.name}>
                                        {menu.name.replace('_', ' ').toUpperCase()}
                                      </option>
                                    ))}
                                  </Form.Select>
                                </Form.Group>
                              </Col>
                            </Row>

                            {!selectedUser && !selectedRole && !selectedMenu && (
                              <div className="text-center py-5">
                                <h5 className="text-muted">Select a user, role, and menu to manage permissions</h5>
                              </div>
                            )}

                            {/* Show role permissions when a role is selected */}
                            {selectedRole && Object.keys(rolePermissions).length > 0 && (
                              <>
                                <div className="mb-3">
                                  <h5>Role Permissions for: <strong>{selectedRole}</strong></h5>
                                </div>

                                {Object.keys(rolePermissions).map(menuName => {
                                  if (selectedMenu && menuName !== selectedMenu) return null;
                                  
                                  const permissions = rolePermissions[menuName];
                                  const allChecked = permissions.view && permissions.create && permissions.update && permissions.delete;
                                  
                                  return (
                                    <div key={menuName} className="permission-row mb-3 p-3 border rounded" style={{
                                      backgroundColor: 'hsl(218.71deg 65.96% 90.78%)',
                                      borderLeft: '4px solid hsl(218.71deg 65.96% 90.78%)'
                                    }}>
                                      <div className="d-flex align-items-center justify-content-between flex-wrap">
                                        <div className="d-flex align-items-center gap-3">
                                          <Form.Check
                                            type="checkbox"
                                            checked={allChecked}
                                            onChange={(e) => handleAllPermissionChange(menuName, e.target.checked)}
                                            disabled={loading}
                                          />
                                          <strong className="text-capitalize">
                                            {menuName.replace('_', ' ')}
                                          </strong>
                                        </div>
                                        <div className="d-flex flex-wrap gap-4">
                                          <Form.Check
                                            type="checkbox"
                                            label="All"
                                            checked={allChecked}
                                            onChange={(e) => handleAllPermissionChange(menuName, e.target.checked)}
                                            disabled={loading}
                                          />
                                          <Form.Check
                                            type="checkbox"
                                            label="View"
                                            checked={permissions.view}
                                            onChange={(e) => handlePermissionChange(menuName, 'view', e.target.checked)}
                                            disabled={loading}
                                          />
                                          <Form.Check
                                            type="checkbox"
                                            label="Create"
                                            checked={permissions.create}
                                            onChange={(e) => handlePermissionChange(menuName, 'create', e.target.checked)}
                                            disabled={loading}
                                          />
                                          <Form.Check
                                            type="checkbox"
                                            label="Update"
                                            checked={permissions.update}
                                            onChange={(e) => handlePermissionChange(menuName, 'update', e.target.checked)}
                                            disabled={loading}
                                          />
                                          <Form.Check
                                            type="checkbox"
                                            label="Delete"
                                            checked={permissions.delete}
                                            onChange={(e) => handlePermissionChange(menuName, 'delete', e.target.checked)}
                                            disabled={loading}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                <div className="text-end mt-3">
                                  <Button variant="warning" onClick={handleUpdatePermission} disabled={loading}>
                                    {loading ? 'Updating...' : 'Update Permission'}
                                  </Button>
                                </div>
                              </>
                            )}
                          </Card.Body>
                        </Card>
                      </div>
                    )}

                    {/* Show message when no features are selected */}
                    {selectedFeatures.length === 0 && (
                      <div className="text-center py-5">
                        <h5 className="text-muted">Select features from the left panel to configure</h5>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              {/* Right Column - Status and Assigned Users */}
              <Col md={3}>
                <Card className="shadow-sm border-0 bg-white h-100">
                  <Card.Header className="bg-light">
                    <h6 className="mb-0">Status</h6>
                  </Card.Header>
                  <Card.Body>
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <span>Status</span>
                        <Form.Check
                          type="switch"
                          id="roleStatus"
                          checked={roleStatus}
                          onChange={(e) => setRoleStatus(e.target.checked)}
                        />
                      </div>
                      <div className="status-info">
                        <div className="mb-2">
                          <strong>Role Name:</strong> 
                          <span className="text-danger ms-1">Not created</span>
                        </div>
                        <div className="mb-2">
                          <strong>Role ID:</strong> 
                          <span className="ms-1">NA</span>
                        </div>
                        <div className="mb-2">
                          <strong>Created by:</strong> 
                          <span className="ms-1">Name</span>
                        </div>
                        <div className="mb-2">
                          <strong>Modified on:</strong> 
                          <span className="ms-1">12-02-2025</span>
                        </div>
                        <div className="mb-2">
                          <strong>Users Assigned:</strong> 
                          <span className="ms-1">0</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h6 className="mb-3">Assigned Users</h6>
                      <div className="border rounded p-3 text-center text-muted" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        No users assigned yet
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        </div>
      </div>
    </>
  );
};

export default UnifiedAdminManagement;