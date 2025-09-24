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
    <Navbar className="top-nav-bar" variant="dark" expand="lg" fixed="top">
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
          <Nav className="ms-auto top-nav-links d-flex align-items-center">
            {isLoggedIn ? (
              <>
                {/* Robot Icon */}
                <Nav.Link  className="d-flex align-items-center me-4" onClick={() => navigate('/chatbot')}>
                  <img 
                    src="/src/assets/chatbot.png" 
                    alt="Chatbot" 
                    style={{ width: '57px', height: '51px' }}
                  />
                </Nav.Link>
                
                {/* Vertical Separator */}
                <div className="vertical-line me-4"></div>
                
                {/* Action Icons Group */}
                <div className="d-flex align-items-center me-3">
                  <Nav.Link href="#" className="d-flex align-items-center me-4">
                    <i className="fas fa-cog" style={{ fontSize: '18px' }}></i>
                  </Nav.Link>
                  <Nav.Link href="#" className="d-flex align-items-center me-4">
                    <i className="fas fa-question-circle" style={{ fontSize: '18px' }}></i>
                  </Nav.Link>
                  <Nav.Link href="#" className="d-flex align-items-center position-relative">
                    <i className="fas fa-bell" style={{ fontSize: '18px' }}></i>
                    <span 
                      className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                      style={{ fontSize: '10px', minWidth: '16px', height: '16px' }}
                    >
                      3
                    </span>
                  </Nav.Link>
                </div>
                
                {/* Vertical Separator */}
                <div className="vertical-line me-4"></div>
                
                {/* User Profile */}
                <Dropdown className="top-nav-user" align="end">
                  <Dropdown.Toggle as={Button} variant="link" className="text-white text-decoration-none p-0">
                    <div className="d-flex align-items-center">
                      <div 
                        className="rounded me-2 d-flex align-items-center justify-content-center"
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          backgroundColor: 'white',
                          border: '2px solid white'
                        }}
                      >
                        <img 
                          src="https://via.placeholder.com/36x36/FFD700/000000?text=LG" 
                          alt="Profile" 
                          className="rounded"
                          style={{ width: '36px', height: '36px' }}
                        />
                      </div>
                      <div className="text-start me-2">
                        <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>Laura Grace</div>
                        <div className="text-dark" style={{ fontSize: '12px', opacity: 0.7 }}>Audit Manager</div>
                      </div>
                      <i className="fas fa-chevron-down text-dark" style={{ fontSize: '12px' }}></i>
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
