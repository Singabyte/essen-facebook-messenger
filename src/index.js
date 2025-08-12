require('dotenv').config();
const express = require('express');
const webhook = require('./webhook');
const { initDatabase, pool } = require('./database-pg');
const { metricsCollector } = require('./monitoring');
const adminSocketClient = require('./admin-socket-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required for DigitalOcean App Platform
app.set('trust proxy', 1);

// Initialize database
initDatabase();

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

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Monitoring endpoints
app.get('/debug/health-quick', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      bot: { healthy: true, status: 'running' },
      database: { healthy: false, status: 'checking' },
      facebook: { healthy: true, status: 'assumed-healthy' },
      gemini: { healthy: true, status: 'assumed-healthy' }
    }
  };
  
  // Quick database check
  try {
    await pool.query('SELECT 1');
    health.services.database.healthy = true;
    health.services.database.status = 'connected';
  } catch (err) {
    health.services.database.status = 'disconnected';
  }
  
  res.json(health);
});

app.get('/debug/metrics', (req, res) => {
  const stats = metricsCollector.getStats();
  res.json(stats);
});

app.get('/debug/system-stats', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    },
    uptime: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid
  });
});

// Server-Sent Events endpoint for real-time message stream
app.get('/debug/message-stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send initial ping
  res.write('data: {"type":"ping"}\n\n');
  
  // Register this client with the admin socket client
  adminSocketClient.addMessageStreamClient(res);
  
  // Keep connection alive with periodic pings
  const pingInterval = setInterval(() => {
    res.write('data: {"type":"ping"}\n\n');
  }, 30000);
  
  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(pingInterval);
    adminSocketClient.removeMessageStreamClient(res);
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ESSEN Facebook Messenger Bot',
    status: 'Running',
    version: '1.0.0'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  
  // Connect to admin backend via Socket.io
  adminSocketClient.connect();
  
  // Send metrics every 30 seconds
  setInterval(() => {
    const metrics = metricsCollector.getStats();
    adminSocketClient.sendMetrics(metrics);
  }, 30000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down');
  process.exit(0);
});