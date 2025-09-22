# User Authentication System Documentation

## Overview
This document provides an overview of the authentication system implemented for the CAG application. The system uses JWT (JSON Web Tokens) for authentication and bcrypt for password hashing.

## Backend Components

### Files
1. `schemas.py` - Pydantic schemas for user data validation
2. `security.py` - Password hashing and verification utilities
3. `token.py` - JWT token generation and validation
4. `auth.py` - FastAPI router for authentication endpoints
5. `dependencies.py` - User authentication dependencies

### Endpoints
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with username/password form data (OAuth2 compatible)
- `POST /api/auth/token-login` - Login with email/password JSON
- `GET /api/user/me` - Get current user information (protected route)

## Frontend Integration

### User Registration
The registration form in `Registration.jsx` collects user information and sends it to the backend registration endpoint. Upon successful registration, the user is redirected to the login page.

### User Login
The login form in `Login.jsx` collects user credentials and sends them to the backend login endpoint. Upon successful authentication, a JWT token is stored in localStorage and the user is redirected to the home page.

### Protected Routes
Protected routes require a valid JWT token. The token is included in API requests via the Authorization header.

## Database Schema
The User model in `models.py` contains the following fields:
- id
- firstname
- lastname
- email
- dob (date of birth)
- contactno (contact number)
- place
- city
- state
- pincode
- gender
- password (hashed)
- role_status
- account_created_at

## Usage

### Registration
To register a new user, fill out the registration form with the required information and submit. Upon successful registration, you will be redirected to the login page.

### Login
To login, enter your email and password. Upon successful authentication, you will be redirected to the home page.

### Authentication Flow
1. User submits registration form
2. Backend validates input and creates user with hashed password
3. User logs in with credentials
4. Backend validates credentials and returns JWT token
5. Frontend stores token in localStorage
6. Frontend includes token in subsequent API requests

## Security Considerations
- Passwords are hashed using bcrypt
- Authentication uses JWT tokens with expiration
- Protected routes require valid tokens
- Cross-Origin Resource Sharing (CORS) is configured for security