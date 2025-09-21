import { Container, Row, Col, Card, Button } from 'react-bootstrap'

const Home = () => {
  return (
    <Container className="py-5">
      <div className="jumbotron text-center py-5 mb-5">
        <h1 className="display-4">Welcome to React Bootstrap</h1>
        <p className="lead">
          A modern React application built with Bootstrap components and React Router.
        </p>
        <Button variant="primary" size="lg">
          Get Started
        </Button>
      </div>

      <Row className="g-4">
        <Col md={4}>
          <Card>
            <Card.Body>
              <Card.Title>Bootstrap Components</Card.Title>
              <Card.Text>
                This app demonstrates various Bootstrap components including cards, buttons, navigation, and more.
              </Card.Text>
              <Button variant="outline-primary">Learn More</Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <Card.Title>React Router</Card.Title>
              <Card.Text>
                Navigation between different pages using React Router for a seamless user experience.
              </Card.Text>
              <Button variant="outline-primary">Learn More</Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card>
            <Card.Body>
              <Card.Title>Responsive Design</Card.Title>
              <Card.Text>
                Built with mobile-first approach ensuring your app looks great on all devices.
              </Card.Text>
              <Button variant="outline-primary">Learn More</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}

export default Home
