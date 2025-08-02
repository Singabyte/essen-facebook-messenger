require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhook = require('./webhook');
const { initDatabase } = require('./database-pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required for DigitalOcean App Platform
app.set('trust proxy', 1);

// Initialize database
initDatabase();

// Initialize Facebook features
const { initializeFacebookFeatures } = require('./facebook-integration');
initializeFacebookFeatures().catch(console.error);

// Initialize admin Socket.io client
const { initializeAdminSocket } = require('./admin-socket-client');
initializeAdminSocket();

// Custom middleware to capture raw body for webhook signature verification
app.use((req, res, next) => {
  // Capture raw body for webhook POST requests
  if (req.url.startsWith('/webhook') && req.method === 'POST') {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk.toString('utf8');
    });
    req.on('end', () => {
      req.rawBody = rawBody;
      try {
        req.body = JSON.parse(rawBody);
      } catch (e) {
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
});

// Routes - mount webhook at /webhook to match Facebook configuration
app.use('/webhook', webhook);

// Middleware for other routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check - IMPORTANT: This must come AFTER webhook router
// Otherwise it might interfere with webhook routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint
app.get('/debug/version', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  let gitCommit = 'unknown';
  let deployTime = 'unknown';
  
  try {
    // Try to read git commit from file if available
    if (fs.existsSync('.git/HEAD')) {
      const head = fs.readFileSync('.git/HEAD', 'utf8').trim();
      if (head.startsWith('ref:')) {
        const ref = head.split(' ')[1];
        gitCommit = fs.readFileSync('.git/' + ref, 'utf8').trim().substring(0, 7);
      }
    }
  } catch (e) {
    // Ignore errors
  }
  
  try {
    // Get file modification time of index.js
    const stats = fs.statSync(path.join(__dirname, 'index.js'));
    deployTime = stats.mtime.toISOString();
  } catch (e) {
    // Ignore errors  
  }
  
  res.json({
    version: '1.0.0',
    gitCommit,
    deployTime,
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
    webhookRouteExists: !!app._router && app._router.stack.some(r => r.regexp && r.regexp.toString().includes('webhook')),
    routes: app._router ? app._router.stack.filter(r => r.route).map(r => r.route.path) : []
  });
});

// Diagnostic endpoint to test message sending
app.post('/debug/test-message', async (req, res) => {
  const axios = require('axios');
  const { recipientId, message = 'Test message from diagnostic endpoint' } = req.body;
  
  if (!recipientId) {
    return res.status(400).json({ error: 'recipientId is required' });
  }
  
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) {
    return res.status(500).json({ 
      error: 'PAGE_ACCESS_TOKEN not configured',
      env: process.env.NODE_ENV,
      hasToken: false
    });
  }
  
  console.log('Test message endpoint called:', {
    recipientId,
    message,
    tokenLength: PAGE_ACCESS_TOKEN.length,
    tokenPrefix: PAGE_ACCESS_TOKEN.substring(0, 10) + '...'
  });
  
  try {
    const response = await axios({
      method: 'post',
      url: 'https://graph.facebook.com/v18.0/me/messages',
      params: { access_token: PAGE_ACCESS_TOKEN },
      data: {
        recipient: { id: recipientId },
        message: { text: message }
      }
    });
    
    console.log('Test message sent successfully:', response.data);
    
    res.json({
      success: true,
      messageId: response.data.message_id,
      recipientId: response.data.recipient_id
    });
  } catch (error) {
    console.error('Test message error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message,
      details: error.response?.data
    });
  }
});

// Debug endpoint to check environment
app.get('/debug/env-check', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV,
    hasPageAccessToken: !!process.env.PAGE_ACCESS_TOKEN,
    hasVerifyToken: !!process.env.VERIFY_TOKEN,
    hasAppSecret: !!process.env.APP_SECRET,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    tokenLength: process.env.PAGE_ACCESS_TOKEN?.length || 0,
    port: process.env.PORT
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ESSEN Facebook Messenger Bot',
    status: 'Running',
    version: '1.0.0',
    endpoints: {
      webhook: '/webhook',
      health: '/health',
      debug: {
        version: '/debug/version',
        envCheck: '/debug/env-check',
        testMessage: '/debug/test-message (POST)'
      }
    },
    message: 'Webhook is available at /webhook'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});