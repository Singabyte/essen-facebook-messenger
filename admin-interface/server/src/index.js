require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy - required for DigitalOcean App Platform
app.set('trust proxy', 1);

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
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize admin user endpoint
app.post('/debug/init-admin', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const queries = require('./db/queries');
  
  try {
    const username = 'admin';
    const password = 'hello123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if admin exists
    const existingUser = await queries.admin.findByUsername(username);
    
    if (existingUser) {
      return res.json({
        success: false,
        message: 'Admin user already exists',
        username: username
      });
    }
    
    // Create admin user
    await queries.admin.createUser(username, hashedPassword);
    
    return res.json({
      success: true,
      message: 'Admin user created successfully',
      username: username,
      password: password,
      note: 'Please change the password after first login!'
    });
    
  } catch (error) {
    console.error('Init admin error:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
});
app.post('/api/debug/init-admin', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const queries = require('./db/queries');
  
  try {
    const username = 'admin';
    const password = 'hello123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if admin exists
    const existingUser = await queries.admin.findByUsername(username);
    
    if (existingUser) {
      return res.json({
        success: false,
        message: 'Admin user already exists',
        username: username
      });
    }
    
    // Create admin user
    await queries.admin.createUser(username, hashedPassword);
    
    return res.json({
      success: true,
      message: 'Admin user created successfully',
      username: username,
      password: password,
      note: 'Please change the password after first login!'
    });
    
  } catch (error) {
    console.error('Init admin error:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
});

// Simple debug endpoint - no database
app.get('/debug/env', (req, res) => {
  const fs = require('fs');
  const dbPath = process.env.DB_PATH || '/workspace/database/bot.db';
  
  res.json({
    dbPath: dbPath,
    dbExists: fs.existsSync(dbPath),
    nodeEnv: process.env.NODE_ENV,
    workDir: process.cwd(),
    dbReadable: fs.existsSync(dbPath) ? fs.accessSync(dbPath, fs.constants.R_OK) === undefined : false,
    dbWritable: fs.existsSync(dbPath) ? fs.accessSync(dbPath, fs.constants.W_OK) === undefined : false
  });
});
app.get('/api/debug/env', (req, res) => {
  const fs = require('fs');
  const dbPath = process.env.DB_PATH || '/workspace/database/bot.db';
  
  res.json({
    dbPath: dbPath,
    dbExists: fs.existsSync(dbPath),
    nodeEnv: process.env.NODE_ENV,
    workDir: process.cwd(),
    dbReadable: fs.existsSync(dbPath) ? fs.accessSync(dbPath, fs.constants.R_OK) === undefined : false,
    dbWritable: fs.existsSync(dbPath) ? fs.accessSync(dbPath, fs.constants.W_OK) === undefined : false
  });
});

// Test login endpoint for debugging
app.post('/debug/test-login', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const queries = require('./db/queries');
  
  try {
    // Test with hardcoded credentials
    const username = 'admin';
    const password = 'hello123';
    
    console.log('Test login attempt for:', username);
    
    // Find user
    const user = await queries.admin.findByUsername(username);
    console.log('User found:', !!user);
    
    if (!user) {
      return res.json({ 
        success: false, 
        error: 'User not found',
        message: 'Admin user does not exist in database'
      });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isValidPassword);
    
    return res.json({
      success: isValidPassword,
      user: user ? { id: user.id, username: user.username } : null,
      passwordMatch: isValidPassword,
      hashedPasswordLength: user.password ? user.password.length : 0
    });
    
  } catch (error) {
    console.error('Test login error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});
app.post('/api/debug/test-login', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const queries = require('./db/queries');
  
  try {
    // Test with hardcoded credentials
    const username = 'admin';
    const password = 'hello123';
    
    console.log('Test login attempt for:', username);
    
    // Find user
    const user = await queries.admin.findByUsername(username);
    console.log('User found:', !!user);
    
    if (!user) {
      return res.json({ 
        success: false, 
        error: 'User not found',
        message: 'Admin user does not exist in database'
      });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isValidPassword);
    
    return res.json({
      success: isValidPassword,
      user: user ? { id: user.id, username: user.username } : null,
      passwordMatch: isValidPassword,
      hashedPasswordLength: user.password ? user.password.length : 0
    });
    
  } catch (error) {
    console.error('Test login error:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Debug database connection
app.get('/debug/db', async (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const { getAdminUsers } = require('./db/queries').admin;
  
  const dbPath = process.env.DB_PATH 
    ? process.env.DB_PATH
    : path.resolve(__dirname, '../../../database/bot.db');
  
  let users = [];
  let dbError = null;
  
  try {
    users = await getAdminUsers();
  } catch (err) {
    dbError = err.message;
  }
  
  res.json({
    envDbPath: process.env.DB_PATH,
    resolvedPath: dbPath,
    exists: fs.existsSync(dbPath),
    workingDir: process.cwd(),
    dirname: __dirname,
    adminUsers: users.length,
    dbError: dbError,
    dbStats: fs.existsSync(dbPath) ? fs.statSync(dbPath) : null
  });
});
app.get('/api/debug/db', async (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const { getAdminUsers } = require('./db/queries').admin;
  
  const dbPath = process.env.DB_PATH 
    ? process.env.DB_PATH
    : path.resolve(__dirname, '../../../database/bot.db');
  
  let users = [];
  let dbError = null;
  
  try {
    users = await getAdminUsers();
  } catch (err) {
    dbError = err.message;
  }
  
  res.json({
    envDbPath: process.env.DB_PATH,
    resolvedPath: dbPath,
    exists: fs.existsSync(dbPath),
    workingDir: process.cwd(),
    dirname: __dirname,
    adminUsers: users.length,
    dbError: dbError,
    dbStats: fs.existsSync(dbPath) ? fs.statSync(dbPath) : null
  });
});

// Auth routes
app.use('/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/auth'));

// Protected routes
app.use('/users', require('./routes/users'));
app.use('/api/users', require('./routes/users'));
app.use('/conversations', require('./routes/conversations'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/appointments', require('./routes/appointments'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/analytics', require('./routes/analytics'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/knowledge-base', require('./routes/knowledge-base'));
app.use('/api/knowledge-base', require('./routes/knowledge-base'));
app.use('/templates', require('./routes/templates'));
app.use('/api/templates', require('./routes/templates'));
app.use('/bot-config', require('./routes/bot-config'));
app.use('/api/bot-config', require('./routes/bot-config'));
app.use('/faqs', require('./routes/faqs'));
app.use('/api/faqs', require('./routes/faqs'));
app.use('/monitoring', require('./routes/monitoring'));
app.use('/api/monitoring', require('./routes/monitoring'));

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
      knowledgeBase: '/knowledge-base',
      templates: '/templates',
      botConfig: '/bot-config',
      faqs: '/faqs',
      monitoring: '/monitoring'
    }
  });
});

// Create HTTP server BEFORE adding error handling middleware
const http = require('http');
const server = http.createServer(app);

// Initialize WebSocket - must be done before error handling middleware
const { initializeWebSocket } = require('./websocket');
const io = initializeWebSocket(server);

// IMPORTANT: Socket.io handles its own routing, no need for manual route handling
// The path configuration in websocket.js handles the /api/socket.io/ prefix

// Error handling middleware - MUST come after Socket.io initialization
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Admin API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log('Routes configured for both /api/* and /* paths');
  console.log(`Socket.io configured with path: /socket.io/`);
  console.log('Note: In production, DigitalOcean strips /api prefix from incoming requests');
});