# React Bootstrap Full-Stack Application

This is a full-stack application with a React Bootstrap frontend and FastAPI backend.

## Project Structure

```
UX-cag/
├── frontend/          # React Bootstrap frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   └── ...
│   └── package.json
├── back_end/          # FastAPI backend
│   ├── main.py        # Main FastAPI application
│   ├── start.py       # Startup script
│   └── requirements.txt
└── README.md
```

## Prerequisites

- Node.js (v20.14.0 or higher)
- Python 3.13
- npm or yarn

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd back_end
   ```

2. Activate the virtual environment:
   ```bash
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. Install dependencies (if not already installed):
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI server:
   ```bash
   python main.py
   # OR
   python start.py
   ```

   The API will be available at: http://127.0.0.1:8000
   API Documentation: http://127.0.0.1:8000/docs

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The frontend will be available at: http://localhost:5173

## Features

### Frontend
- ✅ React 19.1.1 with JSX
- ✅ React Bootstrap 2.10.10 components
- ✅ React Router DOM 7.9.1 for navigation
- ✅ Responsive design
- ✅ Modern UI with custom styling
- ✅ Contact form with backend integration
- ✅ Multiple pages (Home, About, Contact)

### Backend
- ✅ FastAPI 0.104.1
- ✅ CORS enabled for frontend communication
- ✅ RESTful API endpoints
- ✅ Pydantic models for data validation
- ✅ Interactive API documentation
- ✅ Contact form submission endpoint

## API Endpoints

- `GET /` - Welcome message
- `GET /api/health` - Health check
- `GET /api/users` - Get all users
- `POST /api/users` - Create a new user
- `GET /api/users/{user_id}` - Get user by ID
- `POST /api/contact` - Submit contact form
- `GET /api/contact` - Get all contact messages
- `GET /api/about` - Get about information

## Development

### Running Both Applications

1. **Terminal 1 - Backend:**
   ```bash
   cd back_end
   venv\Scripts\activate  # Windows
   python main.py
   ```

2. **Terminal 2 - Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

### Available Scripts

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

**Backend:**
- `python main.py` - Start FastAPI server
- `python start.py` - Start with custom configuration

## Technologies Used

### Frontend
- React 19.1.1
- React Bootstrap 2.10.10
- React Router DOM 7.9.1
- Axios 1.12.2
- Vite 7.1.6
- ESLint 9.36.0

### Backend
- FastAPI 0.104.1
- Pydantic 1.10.13
- Uvicorn 0.24.0
- Python 3.13

## Troubleshooting

### Common Issues

1. **Port already in use:**
   - Backend: Change port in `main.py` (line with `uvicorn.run`)
   - Frontend: Vite will automatically use the next available port

2. **CORS errors:**
   - Make sure backend is running on port 8000
   - Check CORS origins in `main.py`

3. **Module not found errors:**
   - Make sure virtual environment is activated
   - Run `pip install -r requirements.txt`

4. **Frontend not connecting to backend:**
   - Ensure backend is running
   - Check the API URL in frontend code
   - Verify CORS settings

## Next Steps

- Add database integration (SQLite, PostgreSQL, etc.)
- Implement user authentication
- Add more API endpoints
- Deploy to production
- Add testing
- Implement error handling
- Add loading states

