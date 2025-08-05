require('dotenv').config();
const express = require('express');
const webhook = require('./webhook');
const { initDatabase } = require('./database-pg');

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