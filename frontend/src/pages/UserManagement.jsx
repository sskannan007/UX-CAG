import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaUserPlus, FaUserCog, FaUserSlash, FaUsers } from 'react-icons/fa';
import { BiEdit } from 'react-icons/bi';
import { MdDeleteOutline, MdLock } from 'react-icons/md';
import { Container, Card, Row, Col, Button, Alert, Table, Badge, Spinner, InputGroup, FormControl, Dropdown } from 'react-bootstrap';
import config from '../config.js';
import '../styles/dashboard.scss';

const UserManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const [newUsers, setNewUsers] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');

  // Handle success message from navigation state
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
      // Clear the navigation state
      navigate('/user-management', { replace: true });
    }
  }, [location.state, navigate]);

  // Fetch users data
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        // First, get all users
        const usersResponse = await fetch(`${config.BASE_URL}/admin/users/all`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!usersResponse.ok) {
          throw new Error(`Failed to fetch users: ${usersResponse.status} ${usersResponse.statusText}`);
        }

        let allUsers = await usersResponse.json();
        
        // Handle search filtering
        if (searchTerm) {
          allUsers = allUsers.filter(user => 
            (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
            (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
          );
        }
        
        // Count user statistics
        const totalCount = allUsers.length;
        const activeCount = allUsers.filter(user => user.role_status === 'active').length;
        const inactiveCount = allUsers.filter(user => user.role_status === 'inactive' || user.role_status === 'unassigned').length;
        const newCount = allUsers.filter(user => {
          // Users created in the last 30 days are "new"
          if (!user.account_created_at) return false;
          const createdDate = new Date(user.account_created_at);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return createdDate >= thirtyDaysAgo;
        }).length;
        
        // Calculate pagination
        const pageSize = 10;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedUsers = allUsers.slice(startIndex, endIndex);
        
        // Format users for display
        const formattedUsers = paginatedUsers.map(user => ({
          id: user.id,
          name: user.name || `User ${user.id}`,
          email: user.email || 'No email',
          phone: user.contactno || 'N/A',
          role: user.role_status || 'Unassigned',
          location: user.place 
            ? `${user.place}${user.city ? `, ${user.city}` : ''}${user.state ? `, ${user.state}` : ''}`
            : user.city 
              ? `${user.city}${user.state ? `, ${user.state}` : ''}` 
              : (user.state || 'N/A'),
          assignedDate: user.account_created_at ? new Date(user.account_created_at).toLocaleDateString() : 'N/A',
          status: user.role_status === 'active' ? 'Active' : 
                 user.role_status === 'inactive' ? 'Inactive' :
                 user.role_status === 'locked' ? 'Locked' : 'Unassigned'
        }));
        
        // Update state with real data
        setUsers(formattedUsers);
        setTotalUsers(totalCount);
        setActiveUsers(activeCount);
        setInactiveUsers(inactiveCount);
        setNewUsers(newCount);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError(`Failed to load users: ${err.message}`);
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentPage, searchTerm]);

  // Handle search input
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on new search
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Navigate to create user page
  const handleCreateUser = () => {
    navigate('/create-user');
  };

  // Navigate to bulk upload page
  const handleBulkUpload = () => {
    navigate('/bulk-upload-users');
  };

  // Handle user edit
  const handleEdit = (userId) => {
    // Implement edit functionality
    console.log(`Edit user with ID: ${userId}`);
    // Redirect to edit page or open modal
  };

  // Handle user lock/unlock
  const handleLock = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'locked' : 'active';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${config.BASE_URL}/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to ${currentStatus === 'Active' ? 'lock' : 'unlock'} user`);
      }

      // Update user in local state
      setUsers(users.map(user => 
        user.id === userId ? { 
          ...user, 
          status: newStatus === 'active' ? 'Active' : 'Locked',
          role_status: newStatus
        } : user
      ));
      
      // Refresh the counts
      if (currentStatus === 'Active') {
        setActiveUsers(prev => prev - 1);
        setInactiveUsers(prev => prev + 1);
      } else {
        setActiveUsers(prev => prev + 1);
        setInactiveUsers(prev => prev - 1);
      }
    } catch (err) {
      console.error("Lock/unlock error:", err);
      setError(`Failed to ${currentStatus === 'Active' ? 'lock' : 'unlock'} user: ${err.message}`);
    }
  };

  // Handle user delete
  const handleDelete = async (userId) => {
    // Get user info for the confirmation dialog
    const userToDelete = users.find(user => user.id === userId);
    const userName = userToDelete ? userToDelete.name : `User ${userId}`;
    
    if (!window.confirm(`Are you sure you want to delete "${userName}"? This will permanently remove the user and all their associated data. This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete user');
      }

      // Parse response to get confirmation
      const result = await response.json().catch(() => ({}));
      
      // Remove user from local state
      setUsers(users.filter(user => user.id !== userId));
      setTotalUsers(prev => prev - 1);
      
      // Update relevant count based on user's status
      if (userToDelete) {
        if (userToDelete.status === 'Active') {
          setActiveUsers(prev => prev - 1);
        } else if (userToDelete.status === 'Inactive' || userToDelete.status === 'Locked') {
          setInactiveUsers(prev => prev - 1);
        }
      }

      // Show success message
      setSuccessMessage(`User "${userName}" has been deleted successfully`);
      
      // Clear any previous error messages
      setError(null);
      
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
      
    } catch (err) {
      console.error("Delete error:", err);
      setError(`Failed to delete user "${userName}": ${err.message}`);
    }
  };

  // Render status badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Active':
        return <Badge bg="success">Active</Badge>;
      case 'Locked':
        return <Badge bg="danger">Locked</Badge>;
      case 'Inactive':
        return <Badge bg="secondary">Inactive</Badge>;
      case 'In Progress':
        return <Badge bg="warning">In Progress</Badge>;
      case 'Completed':
        return <Badge bg="info">Completed</Badge>;
      default:
        return <Badge bg="light" text="dark">{status}</Badge>;
    }
  };

  // Render action dropdown
  const renderActionDropdown = (user) => {
    return (
      <Dropdown>
        <Dropdown.Toggle variant="light" size="sm" id={`action-${user.id}`}>
          <i className="fas fa-ellipsis-v"></i>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => handleEdit(user.id)}>
            <BiEdit className="me-2" /> Edit
          </Dropdown.Item>
          <Dropdown.Item onClick={() => handleLock(user.id, user.status)}>
            <MdLock className="me-2" /> {user.status === 'Active' ? 'Lock' : 'Unlock'}
          </Dropdown.Item>
          <Dropdown.Item onClick={() => handleDelete(user.id)} className="text-danger">
            <MdDeleteOutline className="me-2" /> Delete
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  };

  return (
    <div className="container-fluid py-4">
      {/* Greeting */}
      <h2 className="dashboard-heading">User Management Dashboard</h2>

      {/* Success Message */}
      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage('')} dismissible>
          {successMessage}
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="dashboard-stats-contain">
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon assigned">
              <i className="fas fa-users"></i>
            </div>
            <div className="stat-content">
              <p className="stat-count">{totalUsers}</p>
              <p className="stat-label">Total Users</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon completed">
              <i className="fas fa-user-check"></i>
            </div>
            <div className="stat-content">
              <p className="stat-count">{activeUsers}</p>
              <p className="stat-label">Active Users</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon unassigned">
              <i className="fas fa-user-times"></i>
            </div>
            <div className="stat-content">
              <p className="stat-count">{inactiveUsers}</p>
              <p className="stat-label">Inactive Users</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon pending">
              <i className="fas fa-user-plus"></i>
            </div>
            <div className="stat-content">
              <p className="stat-count">{newUsers}</p>
              <p className="stat-label">New Users</p>
            </div>
          </div>
          
          <div className="dashboard-buttons">
            <button 
              className="btn-add-document"
              onClick={handleCreateUser}
            >
              <i className="fas fa-user-plus"></i>
              Add User
            </button>
            <button 
              className="btn-assign-document"
              onClick={handleBulkUpload}
            >
              <i className="fas fa-upload"></i>
              Bulk Upload
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <Card className="shadow-sm table-card">
        <Card.Header className="bg-white">
          <Row className="align-items-center">
            <Col md={6}>
              <h5 className="mb-0 table-heading">All Users</h5>
            </Col>
            <Col md={6}>
              <div className="d-flex gap-3 align-items-center justify-content-end">
                <div className="search-input-group" style={{ width: '300px' }}>
                  <InputGroup>
                    <FormControl 
                      placeholder="Search users..." 
                      value={searchTerm}
                      onChange={handleSearchChange}
                    />
                    <InputGroup.Text>
                      <i className="fas fa-search"></i>
                    </InputGroup.Text>
                  </InputGroup>
                </div>
                <Button variant="outline-secondary" className="filter-btn">
                  <i className="fas fa-filter me-2"></i>
                  Filters
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Header>
        <Card.Body className="p-0">
          {error && (
            <Alert variant="danger" className="m-3">
              {error}
            </Alert>
          )}
          
          <div className="view-files-table-container">
            <Table responsive hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>S.NO</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone Number</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Created at</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4 text-muted">
                      <i className="fas fa-users fa-2x mb-2 d-block"></i>
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user, index) => (
                    <tr key={user.id}>
                      <td className="text-center fw-medium text-muted">
                        {index + 1}
                      </td>
                      <td className="fw-medium">{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone}</td>
                      <td>{user.role}</td>
                      <td>{user.location}</td>
                      <td>{user.assignedDate}</td>
                      <td className="badge-style">{renderStatusBadge(user.status)}</td>
                      <td>{renderActionDropdown(user)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
        <Card.Footer className="bg-light">
          <Row className="align-items-center">
            <Col md={6}>
              <div className="d-flex align-items-center gap-3">
                <span className="text-muted">Go to</span>
                <FormControl 
                  type="number" 
                  style={{ width: '60px' }} 
                  defaultValue="10"
                />
                <span className="text-muted">page</span>
              </div>
            </Col>
            <Col md={6}>
              <div className="d-flex justify-content-end gap-2">
                <Button 
                  className="page-button" 
                  variant="outline-primary" 
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  <i className="fas fa-angle-left"></i>
                </Button>
                {Array.from({ length: Math.min(5, Math.ceil(totalUsers / 10)) }, (_, i) => (
                  <Button 
                    key={i + 1}
                    className={`page-button ${currentPage === i + 1 ? 'btn-primary' : 'btn-outline-primary'}`}
                    variant={currentPage === i + 1 ? 'primary' : 'outline-primary'}
                    size="sm"
                    onClick={() => handlePageChange(i + 1)}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button 
                  className="page-button" 
                  variant="outline-primary" 
                  size="sm"
                  disabled={currentPage >= Math.ceil(totalUsers / 10)}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  <i className="fas fa-angle-right"></i>
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default UserManagement;