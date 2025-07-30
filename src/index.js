require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhook = require('./webhook');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Initialize Facebook features
const { initializeFacebookFeatures } = require('./facebook-integration');
initializeFacebookFeatures().catch(console.error);

// Custom middleware to capture raw body for webhook signature verification
app.use((req, res, next) => {
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

// Routes - webhook first to ensure proper body handling
app.use('/webhook', webhook);

// Middleware for other routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
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

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    name: 'Facebook Messenger Bot',
    status: 'Running',
    version: '1.0.0'
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