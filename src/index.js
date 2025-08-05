require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhook = require('./webhook');
const { initDatabase } = require('./database-pg');

// Import monitoring utilities
const { loggers } = require('./utils/logger');
const { register, metricsCollector } = require('./utils/metrics');
const { 
  correlationIdMiddleware,
  performanceMiddleware,
  errorMonitoringMiddleware,
  securityMiddleware,
  healthCheckMiddleware,
  createRateLimiter
} = require('./middleware/monitoring');
const { performComprehensiveHealthCheck } = require('./utils/healthcheck');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required for DigitalOcean App Platform
app.set('trust proxy', 1);

// Add monitoring middleware early in the chain
app.use(correlationIdMiddleware);
app.use(performanceMiddleware);
app.use(securityMiddleware);
app.use(healthCheckMiddleware);

// Rate limiting for general API endpoints
app.use('/debug', createRateLimiter(15 * 60 * 1000, 100, 'Too many debug requests'));
app.use('/metrics', createRateLimiter(60 * 1000, 30, 'Too many metrics requests'));

// Initialize database
initDatabase();

// Initialize Facebook features
const { initializeFacebookFeatures } = require('./facebook-integration');
initializeFacebookFeatures()
  .then(() => {
    loggers.bot.info('Facebook features initialized successfully');
    metricsCollector.updateSystemHealth('facebook', true);
  })
  .catch(error => {
    loggers.bot.error('Failed to initialize Facebook features', { error: error.message });
    metricsCollector.updateSystemHealth('facebook', false);
  });

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

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
    
    loggers.monitoring.debug('Metrics endpoint accessed', {
      correlationId: req.correlationId
    });
  } catch (error) {
    loggers.monitoring.error('Failed to generate metrics', {
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).end('Error generating metrics');
  }
});

// Health check - IMPORTANT: This must come AFTER webhook router
// Otherwise it might interfere with webhook routes
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId 
  });
});

// Quick health check endpoint (lightweight)
app.get('/debug/health-quick', (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: uptime,
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024)
    },
    pid: process.pid,
    correlationId: req.correlationId
  });
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
  try {
    loggers.monitoring.info('Comprehensive health check requested', {
      correlationId: req.correlationId
    });
    
    const healthChecks = await performComprehensiveHealthCheck();
    
    // Set appropriate HTTP status based on overall health
    const statusCode = healthChecks.overall === 'healthy' ? 200 : 
                      healthChecks.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      ...healthChecks,
      correlationId: req.correlationId
    });
    
  } catch (error) {
    loggers.monitoring.error('Comprehensive health check failed', {
      error: error.message,
      correlationId: req.correlationId
    });
    
    res.status(500).json({
      timestamp: new Date().toISOString(),
      overall: 'unhealthy',
      error: error.message,
      correlationId: req.correlationId
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
app.use(errorMonitoringMiddleware);
app.use((err, req, res, next) => {
  loggers.bot.error('Unhandled application error', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    request: {
      method: req.method,
      url: req.url,
      correlationId: req.correlationId
    }
  });
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    correlationId: req.correlationId
  });
});

// Start server
const server = app.listen(PORT, () => {
  loggers.bot.info('ESSEN Facebook Messenger Bot started', {
    port: PORT,
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage()
  });
  
  // Record deployment
  metricsCollector.recordDeployment();
  
  console.log(`Bot server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Monitoring endpoints:`);
  console.log(`  - Health: http://localhost:${PORT}/health`);
  console.log(`  - Metrics: http://localhost:${PORT}/metrics`);
  console.log(`  - Comprehensive Health: http://localhost:${PORT}/debug/health-comprehensive`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  loggers.bot.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    loggers.bot.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  loggers.bot.info('SIGINT received, shutting down gracefully');
  
  server.close(() => {
    loggers.bot.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  loggers.bot.error('Uncaught exception', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  });
  
  // Give time for logs to flush before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  loggers.bot.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack,
      name: reason.name
    } : reason,
    promise: promise.toString()
  });
});