import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaUserPlus, FaUserCog, FaUserSlash, FaUsers } from 'react-icons/fa';
import { BiEdit } from 'react-icons/bi';
import { MdDeleteOutline, MdLock } from 'react-icons/md';
import config from '../config.js';

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
    if (!window.confirm('Are you sure you want to delete this user?')) {
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

      // Remove user from local state
      setUsers(users.filter(user => user.id !== userId));
      setTotalUsers(prev => prev - 1);
      
      // Update relevant count based on user's status
      const userToDelete = users.find(user => user.id === userId);
      if (userToDelete) {
        if (userToDelete.status === 'Active') {
          setActiveUsers(prev => prev - 1);
        } else if (userToDelete.status === 'Inactive') {
          setInactiveUsers(prev => prev - 1);
        }
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError(`Failed to delete user: ${err.message}`);
    }
  };

  // Render status badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Active':
        return <span className="badge bg-success">Active</span>;
      case 'Locked':
        return <span className="badge bg-danger">Locked</span>;
      case 'Inactive':
        return <span className="badge bg-secondary">Inactive</span>;
      case 'In Progress':
        return <span className="badge bg-warning">In Progress</span>;
      case 'Completed':
        return <span className="badge bg-info">Completed</span>;
      default:
        return <span className="badge bg-light text-dark">{status}</span>;
    }
  };

  // Render action dropdown
  const renderActionDropdown = (user) => {
    return (
      <div className="dropdown">
        <button className="btn btn-light btn-sm" type="button" id={`action-${user.id}`} data-bs-toggle="dropdown" aria-expanded="false">
          <i className="fas fa-ellipsis-v"></i>
        </button>
        <ul className="dropdown-menu" aria-labelledby={`action-${user.id}`}>
          <li><button className="dropdown-item" onClick={() => handleEdit(user.id)}>
            <BiEdit className="me-2" /> Edit
          </button></li>
          <li><button className="dropdown-item" onClick={() => handleLock(user.id, user.status)}>
            <MdLock className="me-2" /> {user.status === 'Active' ? 'Lock' : 'Unlock'}
          </button></li>
          <li><button className="dropdown-item text-danger" onClick={() => handleDelete(user.id)}>
            <MdDeleteOutline className="me-2" /> Delete
          </button></li>
        </ul>
      </div>
    );
  };

  return (
    <div className="container-fluid p-4">
      <h2 className="mb-4">User Management</h2>

      {/* Success Message */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {successMessage}
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setSuccessMessage('')}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Stats cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-light p-3 me-3">
                <FaUsers size={24} className="text-primary" />
              </div>
              <div>
                <h5 className="card-title">{totalUsers}</h5>
                <p className="card-text text-muted">Total Users</p>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-light p-3 me-3">
                <FaUserCog size={24} className="text-success" />
              </div>
              <div>
                <h5 className="card-title">{activeUsers}</h5>
                <p className="card-text text-muted">Active Users</p>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-light p-3 me-3">
                <FaUserSlash size={24} className="text-secondary" />
              </div>
              <div>
                <h5 className="card-title">{inactiveUsers}</h5>
                <p className="card-text text-muted">Inactive Users</p>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-light p-3 me-3">
                <FaUserPlus size={24} className="text-info" />
              </div>
              <div>
                <h5 className="card-title">{newUsers}</h5>
                <p className="card-text text-muted">New Users</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons and search */}
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <button className="btn btn-primary me-2" onClick={handleCreateUser}>
                <FaUserPlus className="me-2" /> New User
              </button>
              <button className="btn btn-outline-primary me-2">
                <i className="fas fa-upload me-2"></i> Bulk Upload
              </button>
            </div>
            <div className="d-flex">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="fas fa-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
              <button className="btn btn-outline-secondary ms-2">
                <i className="fas fa-filter"></i> Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="card shadow-sm">
        <div className="card-body">
          <h5 className="card-title mb-3">All Users</h5>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center my-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone Number</th>
                      <th>Role</th>
                      <th>Location</th>
                      <th>Assigned on</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length > 0 ? (
                      users.map(user => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>{user.phone}</td>
                          <td>{user.role}</td>
                          <td>{user.location}</td>
                          <td>{user.assignedDate}</td>
                          <td>{renderStatusBadge(user.status)}</td>
                          <td>{renderActionDropdown(user)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="text-center">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center mt-4">
                <div>
                  <span className="text-muted">
                    Showing page {currentPage} of {Math.ceil(totalUsers / 10)}
                  </span>
                </div>
                <nav>
                  <ul className="pagination">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => handlePageChange(currentPage - 1)}>
                        <i className="fas fa-chevron-left"></i>
                      </button>
                    </li>
                    {Array.from({ length: Math.min(5, Math.ceil(totalUsers / 10)) }, (_, i) => (
                      <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => handlePageChange(i + 1)}>
                          {i + 1}
                        </button>
                      </li>
                    ))}
                    <li className={`page-item ${currentPage >= Math.ceil(totalUsers / 10) ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => handlePageChange(currentPage + 1)}>
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;