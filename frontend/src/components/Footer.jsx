import { Container, Row, Col } from 'react-bootstrap'

const Footer = () => {
  return (
    <footer className="bg-dark text-light py-4 mt-auto">
      <Container>
        <Row>
          <Col md={6}>
            <h5>React Bootstrap App</h5>
            <p className="mb-0">A modern React application built with Bootstrap.</p>
          </Col>
          <Col md={6} className="text-md-end">
            <p className="mb-0">&copy; 2024 React Bootstrap App. All rights reserved.</p>
          </Col>
        </Row>
      </Container>
    </footer>
  )
}

export default Footer

