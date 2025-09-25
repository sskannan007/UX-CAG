import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import BotImage from '../assets/assistant.png';
import ChatbotImage from '../assets/chatbot.png';
import SendIcon from '../assets/send-arrow.png';
// import '../styles/chatbot.css';

const Chatbot = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRelatedQuestions, setShowRelatedQuestions] = useState(false);
  const [hasMessages, setHasMessages] = useState(false);
  const messagesEndRef = useRef(null);

  const relatedQuestions = [
    "What are the key findings from the compliance audit?",
    "What are the major non-compliances identified?",
    "What are the recommendations provided?",
    "What is the overall compliance status?",
    "What are the financial implications mentioned?",
    "What are the timeline requirements for compliance?",
    "What are the specific areas of concern?",
    "What are the corrective actions suggested?"
  ];

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
    setShowRelatedQuestions(false);
    setHasMessages(false);
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

  const callBackendAPI = async (query) => {
    try {
      // Ensure query is a string
      const queryString = String(query).trim();
      console.log('API call with query:', queryString, 'Type:', typeof queryString);
      
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': '8122'
        },
        body: JSON.stringify({ query: queryString })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error.message,
        summary: "Sorry, I couldn't process your request at the moment.",
        chunks: [],
        sources: []
      };
    }
  };

  const formatBotResponse = (apiResponse) => {
    if (!apiResponse.success || apiResponse.error) {
      return `❌ **Error**: ${apiResponse.error || 'Unknown error occurred'}\n\nPlease try again later.`
    }

    let formattedResponse = `📋 **Summary**\n${apiResponse.summary}\n\n`

    if (apiResponse.chunks && apiResponse.chunks.length > 0) {
      formattedResponse += `📄 **Detailed Information**\n`
      apiResponse.chunks.forEach((chunk, index) => {
        // Add separator line between chunks (except for the first one)
        if (index > 0) {
          formattedResponse += `\n---\n\n`
        }
        
        formattedResponse += `**Chunk ${index + 1}:**\n${chunk.text}\n`
        
        if (chunk.source) {
          const sourceInfo = Object.entries(chunk.source)
            .filter(([key, value]) => value && value !== '')
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
          if (sourceInfo) {
            formattedResponse += `\n*Source: ${sourceInfo}*\n`
          }
        }
        if (chunk.score) {
          formattedResponse += `*Relevance Score: ${chunk.score}*\n`
        }
      })
    }

    if (apiResponse.sources && apiResponse.sources.length > 0) {
      formattedResponse += `\n📁 **Sources**\n`
      apiResponse.sources.forEach((source, index) => {
        formattedResponse += `${index + 1}. ${source}\n`
      })
    }

    return formattedResponse
  }

  const sendMessage = async (messageText = null) => {
    const messageToSend = messageText || newMessage.trim();
    
    if (!messageToSend) {
      console.log('No message to send');
      return;
    }

    console.log('sendMessage called with:', messageToSend);

    const activeConv = getActiveConversation();
    if (!activeConv) {
      console.log('No active conversation, creating new chat');
      createNewChat();
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: String(messageToSend),
      timestamp: new Date()
    };

    // Add user message immediately
    setConversations(prev => 
      prev.map(conv => 
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, userMessage],
              title: conv.messages.length === 0 ? String(userMessage.content).substring(0, 30) + (String(userMessage.content).length > 30 ? '...' : '') : conv.title
            }
          : conv
      )
    );

    const query = messageToSend;
    setIsLoading(true);
    setError('');
    setNewMessage('');
    setShowRelatedQuestions(false);
    setHasMessages(true);

    try {
      console.log('Sending query:', query, 'Type:', typeof query);
      const apiResponse = await callBackendAPI(String(query));
      console.log('Received API response:', apiResponse);
      const formattedResponse = formatBotResponse(apiResponse);
      console.log('Formatted response:', formattedResponse);
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: formattedResponse,
        timestamp: new Date()
      };

      setConversations(prev => 
        prev.map(conv => 
          conv.id === activeConversationId
            ? {
                ...conv,
                messages: [...conv.messages, botMessage]
              }
            : conv
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `❌ **Error**: Failed to get response from server. Please try again later.`,
        timestamp: new Date()
      };

      setConversations(prev => 
        prev.map(conv => 
          conv.id === activeConversationId
            ? {
                ...conv,
                messages: [...conv.messages, errorMessage]
              }
            : conv
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const loadConversation = (conversationId) => {
    setActiveConversationId(conversationId);
    const conversation = conversations.find(conv => conv.id === conversationId);
    setHasMessages(conversation && conversation.messages.length > 0);
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

  const handleQuestionClick = (question) => {
    sendMessage(String(question));
  };

  const handleNewChat = () => {
    createNewChat();
    setShowRelatedQuestions(false);
    setHasMessages(false);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      setShowRelatedQuestions(true);
    } else {
      setShowRelatedQuestions(false);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeConversation = getActiveConversation();

  return (
    <div style={{ height: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center p-3" style={{ backgroundColor: 'white', borderBottom: '1px solid #dee2e6' }}>
        <div className="d-flex align-items-center">
          <span 
            className="text-primary fw-bold me-2" 
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/dashboard')}
          >
            Overview
          </span>
          <span className="text-muted me-2">{'>'}</span>
          <span className="text-muted">New Chat</span>
        </div>
        <Button 
          variant="outline-secondary" 
          size="sm"
          onClick={() => navigate('/dashboard')}
        >
          Close
        </Button>
      </div>

      {/* Main Content */}
      <div className="d-flex" style={{ height: 'calc(100vh - 60px)' }}>
        {/* Left Sidebar - Chatbot Sidebar */}
        <div className="bg-light border-end d-flex flex-column" style={{ width: '300px', minHeight: '100%' }}>
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
                onClick={handleNewChat}
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
        </div>

        {/* Main Chat Area */}
        <div className="flex-grow-1 d-flex flex-column">
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

          {/* Input Area - Positioned at top when no messages, bottom when messages exist */}
          {!hasMessages && (
            <div className="p-3 bg-white">
              {/* Chatbot Image */}
              <div className="text-center mb-4">
                <img 
                  src={ChatbotImage} 
                  alt="Chatbot" 
                  style={{ width: '120px', height: '120px', objectFit: 'contain' }}
                />
              </div>
              
              <InputGroup className="chatbot-input-group">
                <InputGroup.Text style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                  <img 
                    src={BotImage} 
                    alt="Bot" 
                    style={{ width: '25px', height: '25px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                </InputGroup.Text>
                <Form.Control
                  as="textarea"
                  className="chatbot-input"
                  placeholder="| Enter your prompt to get your insights"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  rows={1}
                  style={{ resize: 'none' }}
                />
                <Button
                  variant="primary"
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isLoading}
                >
                  {isLoading ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <img 
                      src={SendIcon} 
                      alt="Send" 
                      style={{ width: '16px', height: '16px' }}
                    />
                  )}
                </Button>
              </InputGroup>
              
              {/* Related Questions - Below input box */}
              {showRelatedQuestions && (
                <div className="mt-3">
                  <div className="text-center mb-3">
                    <h6 className="text-muted">Suggested Questions</h6>
                  </div>
                  <div className="row g-2">
                    {relatedQuestions.map((question, index) => (
                      <div key={index} className="col-md-6">
                        <Button
                          variant="outline-primary"
                          className="w-100 text-start"
                          size="sm"
                          onClick={() => handleQuestionClick(question)}
                          style={{ 
                            whiteSpace: 'normal',
                            height: 'auto',
                            padding: '8px 12px',
                            fontSize: '0.9rem'
                          }}
                        >
                          {question}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages Area - Only show when there are messages */}
          {hasMessages && (
            <div className="flex-grow-1 overflow-auto p-3" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {error && (
                <div className="alert alert-danger mb-3">
                  {error}
                </div>
              )}
              {activeConversation && activeConversation.messages.length > 0 && (
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
              )}
              {isLoading && (
                <div className="d-flex align-items-center mb-2">
                  <div className="me-2 mt-1">
                    <img 
                      src={BotImage} 
                      alt="Bot" 
                      style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center mb-1">
                      <small className="text-muted">Proofbot</small>
                    </div>
                    <div className="p-2 rounded bg-light text-dark d-inline-block">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Area - Positioned at bottom when messages exist */}
          {hasMessages && (
            <div className="p-3 border-top bg-white">
              <InputGroup>
                <InputGroup.Text style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
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
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  rows={1}
                  style={{ resize: 'none' }}
                />
                <Button
                  variant="primary"
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isLoading}
                >
                  {isLoading ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <img 
                      src={SendIcon} 
                      alt="Send" 
                      style={{ width: '16px', height: '16px' }}
                    />
                  )}
                </Button>
              </InputGroup>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chatbot;



