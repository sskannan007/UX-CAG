import { Container, Row, Col, Card, ListGroup } from 'react-bootstrap'

const About = () => {
  return (
    <Container className="py-5">
      <Row>
        <Col lg={8} className="mx-auto">
          <Card>
            <Card.Header>
              <h2 className="mb-0">About This Project</h2>
            </Card.Header>
            <Card.Body>
              <p className="lead">
                This is a React Bootstrap application that demonstrates the integration of 
                React with Bootstrap components and React Router for navigation.
              </p>
              
              <h4>Technologies Used:</h4>
              <ListGroup variant="flush">
                <ListGroup.Item>
                  <strong>React 19.1.1</strong> - JavaScript library for building user interfaces
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>React Bootstrap 2.10.10</strong> - Bootstrap components rebuilt for React
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>React Router DOM 7.9.1</strong> - Declarative routing for React
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>Bootstrap 5.3.8</strong> - CSS framework for responsive design
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>Vite 7.1.6</strong> - Fast build tool and development server
                </ListGroup.Item>
              </ListGroup>

              <h4 className="mt-4">Features:</h4>
              <ul>
                <li>Responsive navigation bar</li>
                <li>Multiple pages with routing</li>
                <li>Bootstrap components integration</li>
                <li>Modern React patterns</li>
                <li>ESLint configuration</li>
                <li>Hot module replacement</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}

export default About

