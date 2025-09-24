import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Button, Form, InputGroup } from 'react-bootstrap';
import BotImage from '../assets/assistant.png';
import SendIcon from '../assets/send-arrow.png';

const Chatbot = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeConversationId]);

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: 'New Chat',
      messages: []
    };
    setConversations(prev => [newChat, ...prev]);
    setActiveConversationId(newChat.id);
  };

  const getActiveConversation = () => {
    return conversations.find(conv => conv.id === activeConversationId);
  };

  const updateConversationTitle = (conversationId, firstMessage) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, title: firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : '') }
          : conv
      )
    );
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const activeConv = getActiveConversation();
    if (!activeConv) {
      createNewChat();
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: newMessage,
      timestamp: new Date()
    };

    const botMessage = {
      id: Date.now() + 1,
      type: 'bot',
      content: `I don't have information on roadways. My expertise is limited to CAG inspection data.`,
      timestamp: new Date()
    };

    setConversations(prev => 
      prev.map(conv => 
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, userMessage, botMessage],
              title: conv.messages.length === 0 ? userMessage.content.substring(0, 30) + (userMessage.content.length > 30 ? '...' : '') : conv.title
            }
          : conv
      )
    );

    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const loadConversation = (conversationId) => {
    setActiveConversationId(conversationId);
  };

  const handleShare = () => {
    console.log('Share clicked');
  };

  const handlePrint = () => {
    console.log('Print clicked');
  };

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeConversation = getActiveConversation();

  return (
    <Container fluid style={{ padding: '20px' }}>
      <Row className="h-100 g-0">
        {/* Left Sidebar */}
        <Col md={3} className="bg-light border-end d-flex flex-column" style={{ minHeight: 'calc(100vh - 160px)' }}>
          {/* Header */}
          <div className="p-3 border-bottom">
            <h5 className="mb-3 text-primary">PROOF BOX</h5>
            
            {/* Search and New Chat */}
            <div className="d-flex gap-2 mb-3">
              <Form.Control
                type="text"
                size="sm"
                placeholder="Search chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                style={{ backgroundColor: '#141824', border: 'none' }}
                size="sm"
                onClick={createNewChat}
              >
                New Chat
              </Button>
            </div>
          </div>

          {/* Conversation History */}
          <div className="flex-grow-1 overflow-auto">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-3 border-bottom cursor-pointer ${
                  activeConversationId === conversation.id ? '#F2F3F7 text-black' : 'hover-bg-light'
                }`}
                onClick={() => loadConversation(conversation.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="d-flex justify-content-between align-items-center" >
                  <div className="flex-grow-1">
                    <div className="fw-bold small">
                      {conversation.title || 'New Chat'}
                    </div>
                    <div className="text-muted small">
                      {conversation.messages.length > 0 
                        ? `${conversation.messages.length} messages`
                        : 'No messages yet'
                      }
                    </div>
                  </div>
                  <div className="dropdown">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-muted p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Chat options clicked');
                      }}
                    >
                      ⋮
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Col>

        {/* Main Chat Area */}
        <Col md={9} className="d-flex flex-column">
          {/* Chat Header */}
          <div className="p-3 border-bottom bg-white d-flex justify-content-between align-items-center">
            <div>
              <h6 className="mb-0">Chat with Proofbot</h6>
            </div>
            <div className="d-flex gap-2">
              <Button variant="outline-secondary" size="sm" onClick={handleShare}>
                📤 
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={handlePrint}>
                🖨️ 
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={handleMenuClick}>
                ⋮
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-grow-1 overflow-auto p-3" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {activeConversation && activeConversation.messages.length > 0 ? (
              activeConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className="mb-2"
                  style={{ width: '100%' }}
                >
                  <div className="d-flex align-items-start">
                    {message.type === 'bot' && (
                      <div className="me-2 mt-1">
                        <img 
                          src={BotImage} 
                          alt="Bot" 
                          style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      </div>
                    )}
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center mb-1">
                        <small className={message.type === 'user' ? 'text-primary fw-bold' : 'text-muted'}>
                          {message.type === 'user' ? 'You' : 'Proofbot'}
                        </small>
                        <small className="text-muted ms-2">
                          {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </small>
                      </div>
                      <div 
                        className={`p-2 rounded ${
                          message.type === 'user'
                            ? 'bg-primary text-white'
                            : 'bg-light text-dark'
                        }`}
                        style={{ 
                          display: 'inline-block',
                          maxWidth: '80%'
                        }}
                      >
                        {message.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted mt-5">
                <h5>Welcome to PROOF BOX</h5>
                <p>Start a new conversation by typing a message below.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-top bg-white">
            <InputGroup>
              <InputGroup.Text className=" text-white">
                <img 
                  src={BotImage} 
                  alt="Bot" 
                  style={{ width: '25px', height: '25px', borderRadius: '50%', objectFit: 'cover' }}
                />
              </InputGroup.Text>
              <Form.Control
                as="textarea"
                placeholder="Type your message here..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={1}
                style={{ resize: 'none' }}
              />
              <Button
                
                onClick={sendMessage}
                disabled={!newMessage.trim()}
              >
                <img 
                  src={SendIcon} 
                  alt="Send" 
                  style={{ width: '16px', height: '16px' }}
                />
              </Button>
            </InputGroup>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Chatbot;
