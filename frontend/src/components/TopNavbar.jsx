import React, { useState } from 'react';
import { Navbar, Nav, Container, Button, Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const TopNavbar = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    navigate('/login');
  };

  return (
    <Navbar bg="primary" variant="dark" expand="lg" fixed="top">
      <Container fluid>
        <Navbar.Brand href="#" className="d-flex align-items-center">
          <div 
            className="me-2 d-flex align-items-center justify-content-center" 
            style={{ 
              width: '40px', 
              height: '40px', 
              backgroundColor: 'white', 
              borderRadius: '8px',
              color: '#007bff',
              fontWeight: 'bold',
              fontSize: '18px'
            }}
          >
            P
          </div>
          <span className="fw-bold">PROOF BOX</span>
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            {isLoggedIn ? (
              <>
                <Nav.Link href="#" className="d-flex align-items-center">
                  <i className="fas fa-robot me-2"></i>
                  AI Assistant
                </Nav.Link>
                <Nav.Link href="#" className="d-flex align-items-center">
                  <i className="fas fa-cog me-2"></i>
                  Settings
                </Nav.Link>
                <Nav.Link href="#" className="d-flex align-items-center">
                  <i className="fas fa-question-circle me-2"></i>
                  Help
                </Nav.Link>
                <Nav.Link href="#" className="d-flex align-items-center position-relative">
                  <i className="fas fa-bell me-2"></i>
                  <span 
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{ fontSize: '10px' }}
                  >
                    3
                  </span>
                </Nav.Link>
                <Dropdown align="end">
                  <Dropdown.Toggle as={Button} variant="link" className="text-white text-decoration-none">
                    <div className="d-flex align-items-center">
                      <div 
                        className="rounded-circle me-2 d-flex align-items-center justify-content-center"
                        style={{ 
                          width: '32px', 
                          height: '32px', 
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          fontSize: '14px'
                        }}
                      >
                        LG
                      </div>
                      <div className="text-start">
                        <div className="fw-bold" style={{ fontSize: '14px' }}>Laura Grace</div>
                        <div style={{ fontSize: '12px', opacity: 0.8 }}>Audit Manager</div>
                      </div>
                      <i className="fas fa-chevron-down ms-2" style={{ fontSize: '12px' }}></i>
                    </div>
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={handleLogout}>
                      <i className="fas fa-sign-out-alt me-2"></i>
                      Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <Button 
                variant="outline-light" 
                onClick={() => navigate('/login')}
              >
                Login
              </Button>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default TopNavbar;
