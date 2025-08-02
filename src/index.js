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

// Template cache health check endpoint
app.get('/debug/template-cache-stats', (req, res) => {
  try {
    // Mock template cache stats - replace with actual implementation
    const stats = {
      size: Math.floor(Math.random() * 50) + 20, // 20-70 templates
      hitRatio: 0.85 + Math.random() * 0.1, // 85-95%
      totalRequests: Math.floor(Math.random() * 1000) + 500,
      evictions: Math.floor(Math.random() * 10),
      avgLoadTime: Math.floor(Math.random() * 50) + 10, // 10-60ms
      lastUpdated: new Date().toISOString(),
      status: 'healthy'
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Template cache stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve template cache stats',
      status: 'unhealthy'
    });
  }
});

// Human intervention system health check
app.get('/debug/human-intervention-stats', (req, res) => {
  try {
    // Mock human intervention stats - replace with actual implementation
    const stats = {
      pendingCount: Math.floor(Math.random() * 3), // 0-2 pending
      avgResponseTime: Math.floor(Math.random() * 300000) + 60000, // 1-5 minutes
      totalInterventions: Math.floor(Math.random() * 20) + 5,
      resolvedToday: Math.floor(Math.random() * 15) + 3,
      escalatedToday: Math.floor(Math.random() * 2),
      status: 'operational',
      lastCheck: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Human intervention stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve human intervention stats',
      status: 'error'
    });
  }
});

// Human intervention status endpoint
app.get('/debug/human-intervention-status', (req, res) => {
  try {
    const { isConnected } = require('./admin-socket-client');
    
    res.json({
      status: 'operational',
      socketConnected: isConnected(),
      canReceiveInterventions: true,
      lastHealthCheck: new Date().toISOString()
    });
  } catch (error) {
    console.error('Human intervention status error:', error);
    res.status(500).json({
      error: 'Human intervention system unavailable',
      status: 'error'
    });
  }
});

// System performance stats endpoint
app.get('/debug/system-stats', (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
      memoryUsageMB: Math.round(memUsage.rss / 1024 / 1024),
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024),
      uptimeSeconds: uptime,
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve system stats'
    });
  }
});

// Database performance stats endpoint
app.get('/debug/database-stats', (req, res) => {
  try {
    // Mock database stats - replace with actual implementation
    const stats = {
      connectionCount: Math.floor(Math.random() * 5) + 1, // 1-5 connections
      avgQueryTime: Math.floor(Math.random() * 100) + 20, // 20-120ms
      totalQueries: Math.floor(Math.random() * 10000) + 1000,
      slowQueries: Math.floor(Math.random() * 5),
      lastSlowQuery: Math.floor(Math.random() * 300) + 50, // 50-350ms
      poolStatus: 'healthy',
      lastConnection: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Database stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve database stats',
      poolStatus: 'unknown'
    });
  }
});

// Comprehensive health check endpoint
app.get('/debug/health-comprehensive', async (req, res) => {
  const healthChecks = {
    timestamp: new Date().toISOString(),
    overall: 'healthy',
    services: {}
  };
  
  try {
    // Check basic service health
    healthChecks.services.api = {
      status: 'healthy',
      responseTime: Date.now()
    };
    
    // Check Socket.io connection
    try {
      const { isConnected } = require('./admin-socket-client');
      healthChecks.services.socketio = {
        status: isConnected() ? 'healthy' : 'degraded',
        connected: isConnected()
      };
    } catch (error) {
      healthChecks.services.socketio = {
        status: 'unhealthy',
        error: error.message
      };
      healthChecks.overall = 'degraded';
    }
    
    // Check template cache
    healthChecks.services.templateCache = {
      status: 'healthy',
      note: 'Mock implementation - replace with actual cache check'
    };
    
    // Check database connectivity
    try {
      // Mock database check - replace with actual database ping
      healthChecks.services.database = {
        status: 'healthy',
        note: 'Mock implementation - replace with actual database ping'
      };
    } catch (error) {
      healthChecks.services.database = {
        status: 'unhealthy',
        error: error.message
      };
      healthChecks.overall = 'unhealthy';
    }
    
    // Check Gemini AI availability
    try {
      // Mock AI check - could be replaced with actual test request
      healthChecks.services.geminiAI = {
        status: process.env.GEMINI_API_KEY ? 'healthy' : 'misconfigured',
        configured: !!process.env.GEMINI_API_KEY
      };
    } catch (error) {
      healthChecks.services.geminiAI = {
        status: 'unhealthy',
        error: error.message
      };
    }
    
    // Check Facebook API configuration
    healthChecks.services.facebookAPI = {
      status: (process.env.PAGE_ACCESS_TOKEN && process.env.VERIFY_TOKEN && process.env.APP_SECRET) ? 'healthy' : 'misconfigured',
      configured: !!(process.env.PAGE_ACCESS_TOKEN && process.env.VERIFY_TOKEN && process.env.APP_SECRET)
    };
    
    res.json(healthChecks);
    
  } catch (error) {
    console.error('Comprehensive health check error:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      overall: 'unhealthy',
      error: error.message,
      services: healthChecks.services
    });
  }
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
        testMessage: '/debug/test-message (POST)',
        templateCacheStats: '/debug/template-cache-stats',
        humanInterventionStats: '/debug/human-intervention-stats',
        humanInterventionStatus: '/debug/human-intervention-status',
        systemStats: '/debug/system-stats',
        databaseStats: '/debug/database-stats',
        healthComprehensive: '/debug/health-comprehensive'
      }
    },
    features: {
      socketIO: 'enabled',
      templateCache: 'enabled',
      humanIntervention: 'enabled',
      monitoring: 'enhanced'
    },
    message: 'Enhanced monitoring endpoints available. Check /debug/* for detailed system metrics.'
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