require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize database
const { initAdminTables } = require('./db/connection');
initAdminTables();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:5173',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/', limiter);

// Routes - Handle both /api/* and /* paths for DigitalOcean ingress
// Health check
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
app.use(['/auth', '/api/auth'], require('./routes/auth'));

// Protected routes
app.use(['/users', '/api/users'], require('./routes/users'));
app.use(['/conversations', '/api/conversations'], require('./routes/conversations'));
app.use(['/appointments', '/api/appointments'], require('./routes/appointments'));
app.use(['/analytics', '/api/analytics'], require('./routes/analytics'));
app.use(['/knowledge-base', '/api/knowledge-base'], require('./routes/knowledge-base'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    name: 'ESSEN Bot Admin API',
    status: 'Running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth/login',
      users: '/users',
      conversations: '/conversations',
      appointments: '/appointments',
      analytics: '/analytics',
      knowledgeBase: '/knowledge-base'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Create HTTP server
const http = require('http');
const server = http.createServer(app);

// Initialize WebSocket
const { initializeWebSocket } = require('./websocket');
initializeWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`Admin API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log('Routes configured for both /api/* and /* paths');
});