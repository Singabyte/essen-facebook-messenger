// Simple test script for monitoring endpoints
require('dotenv').config();
const express = require('express');
const { metricsCollector } = require('./src/monitoring');
const adminSocketClient = require('./src/admin-socket-client');

const app = express();
const PORT = 3001;

// Monitoring endpoints
app.get('/debug/health-quick', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      bot: { healthy: true, status: 'running' },
      database: { healthy: true, status: 'mocked' },
      facebook: { healthy: true, status: 'assumed-healthy' },
      gemini: { healthy: true, status: 'assumed-healthy' }
    }
  };
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

app.get('/', (req, res) => {
  res.json({
    name: 'ESSEN Bot Monitoring Test',
    status: 'Running',
    endpoints: [
      '/debug/health-quick',
      '/debug/metrics',
      '/debug/system-stats'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Test monitoring server running on port ${PORT}`);
  
  // Connect to admin backend via Socket.io
  adminSocketClient.connect();
  
  // Simulate some metrics
  console.log('Simulating message processing...');
  setInterval(() => {
    // Simulate a message
    const userId = `user_${Math.floor(Math.random() * 10)}`;
    const responseTime = Math.floor(Math.random() * 500) + 100;
    
    metricsCollector.recordMessage(userId, Date.now(), responseTime);
    
    // Send to admin
    adminSocketClient.sendMessageProcessed({
      userId: userId,
      userName: `Test User ${userId}`,
      messageText: 'Test message',
      responseText: 'Test response',
      responseTime: responseTime
    });
    
    console.log(`Simulated message from ${userId}, response time: ${responseTime}ms`);
  }, 5000); // Every 5 seconds
  
  // Send metrics every 30 seconds
  setInterval(() => {
    const metrics = metricsCollector.getStats();
    adminSocketClient.sendMetrics(metrics);
    console.log('Sent metrics update:', metrics);
  }, 30000);
});

// Test the endpoints
setTimeout(() => {
  console.log('\nTest endpoints:');
  console.log('http://localhost:3001/debug/metrics');
  console.log('http://localhost:3001/debug/health-quick');
  console.log('http://localhost:3001/debug/system-stats');
}, 1000);