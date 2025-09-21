// Configuration file for the application
const config = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  API_TIMEOUT: 30000,
  UPLOAD_MAX_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_FILE_TYPES: ['.json', '.csv', '.xlsx', '.xls', '.pdf', '.txt', '.docx'],
  VERSION: '1.0.0'
};

export default config;
