const express = require('express');
const axios = require('axios');
const router = express.Router();

// Bot service URL - should be configurable
// In DigitalOcean App Platform, services can communicate via their service names
const BOT_SERVICE_URL = process.env.BOT_SERVICE_URL || 
                       process.env.APP_URL || // Try using the main app URL
                       'https://essen-messenger-bot-zxxtw.ondigitalocean.app'; // Fallback to known URL
console.log('Monitoring routes initialized with BOT_SERVICE_URL:', BOT_SERVICE_URL);
console.log('Environment check - BOT_SERVICE_URL env:', process.env.BOT_SERVICE_URL);
console.log('Environment check - APP_URL env:', process.env.APP_URL);

// Test endpoint to verify proxy configuration
router.get('/test', async (req, res) => {
  res.json({
    status: 'ok',
    botServiceUrl: BOT_SERVICE_URL,
    timestamp: new Date().toISOString(),
    env: {
      BOT_SERVICE_URL: process.env.BOT_SERVICE_URL,
      APP_URL: process.env.APP_URL,
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

/**
 * Proxy requests to bot monitoring endpoints
 * This allows the admin interface to access bot metrics safely
 */

// Health comprehensive endpoint
router.get('/health-comprehensive', async (req, res) => {
  try {
    // First try the comprehensive health check with a shorter timeout
    try {
      const response = await axios.get(`${BOT_SERVICE_URL}/debug/health-comprehensive`, {
        timeout: 8000, // 8 seconds to allow for the internal 3-second timeouts
        headers: {
          'Accept': 'application/json',
          'X-Forwarded-For': req.ip,
          'X-Correlation-Id': req.headers['x-correlation-id'] || require('crypto').randomUUID()
        }
      });
      
      res.json(response.data);
    } catch (firstError) {
      // If comprehensive check fails, try the quick health check
      console.log('Comprehensive health check failed, trying quick health check');
      
      const quickResponse = await axios.get(`${BOT_SERVICE_URL}/debug/health-quick`, {
        timeout: 2000,
        headers: {
          'Accept': 'application/json',
          'X-Correlation-Id': req.headers['x-correlation-id'] || require('crypto').randomUUID()
        }
      });
      
      // Return a simplified health response based on quick check
      res.json({
        timestamp: new Date().toISOString(),
        overall: 'degraded',
        quickCheckOnly: true,
        services: {
          bot: {
            healthy: true,
            status: 'running',
            uptime: quickResponse.data.uptime,
            memory: quickResponse.data.memory
          },
          database: { healthy: true, status: 'assumed-healthy' },
          facebook: { healthy: true, status: 'assumed-healthy' },
          gemini: { healthy: true, status: 'assumed-healthy' },
          socketio: { healthy: true, status: 'assumed-healthy' }
        }
      });
    }
  } catch (error) {
    console.error('Failed to fetch comprehensive health:', error.message);
    console.error('Bot service URL:', BOT_SERVICE_URL);
    console.error('Error code:', error.code);
    
    // Return fallback data structure
    res.status(error.response?.status || 500).json({
      timestamp: new Date().toISOString(),
      overall: 'unhealthy',
      error: 'Cannot connect to bot service',
      services: {
        bot: { 
          healthy: false, 
          status: 'error', 
          error: 'Service unavailable' 
        },
        database: { 
          healthy: false, 
          status: 'unknown', 
          error: 'Cannot verify database status' 
        },
        facebook: { 
          healthy: false, 
          status: 'unknown', 
          error: 'Cannot verify Facebook API status' 
        },
        gemini: { 
          healthy: false, 
          status: 'unknown', 
          error: 'Cannot verify Gemini AI status' 
        },
        socketio: { 
          healthy: false, 
          status: 'unknown', 
          error: 'Cannot verify Socket.io status' 
        }
      }
    });
  }
});

// System stats endpoint
router.get('/system-stats', async (req, res) => {
  try {
    const response = await axios.get(`${BOT_SERVICE_URL}/debug/system-stats`, {
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'X-Forwarded-For': req.ip,
        'X-Correlation-Id': req.headers['x-correlation-id'] || require('crypto').randomUUID()
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch system stats:', error.message);
    console.error('Bot service URL:', `${BOT_SERVICE_URL}/debug/system-stats`);
    console.error('Error details:', error.response?.data || error.code);
    
    res.status(error.response?.status || 500).json({
      error: 'Cannot fetch system stats',
      memoryUsageMB: 0,
      heapUsedMB: 0,
      heapTotalMB: 0,
      uptimeSeconds: 0,
      nodeVersion: 'unknown',
      platform: 'unknown'
    });
  }
});

// Template cache stats endpoint
router.get('/template-cache-stats', async (req, res) => {
  try {
    const response = await axios.get(`${BOT_SERVICE_URL}/debug/template-cache-stats`, {
      timeout: 5000
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch template cache stats:', error.message);
    
    res.status(error.response?.status || 500).json({
      error: 'Cannot fetch template cache stats',
      size: 0,
      hitRatio: 0,
      totalRequests: 0,
      evictions: 0,
      status: 'unknown'
    });
  }
});

// Human intervention stats endpoint
router.get('/human-intervention-stats', async (req, res) => {
  try {
    const response = await axios.get(`${BOT_SERVICE_URL}/debug/human-intervention-stats`, {
      timeout: 5000
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch human intervention stats:', error.message);
    
    res.status(error.response?.status || 500).json({
      error: 'Cannot fetch human intervention stats',
      pendingCount: 0,
      avgResponseTime: 0,
      totalInterventions: 0,
      resolvedToday: 0,
      status: 'unknown'
    });
  }
});

// Database stats endpoint
router.get('/database-stats', async (req, res) => {
  try {
    const response = await axios.get(`${BOT_SERVICE_URL}/debug/database-stats`, {
      timeout: 5000
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch database stats:', error.message);
    
    res.status(error.response?.status || 500).json({
      error: 'Cannot fetch database stats',
      connectionCount: 0,
      avgQueryTime: 0,
      totalQueries: 0,
      poolStatus: 'unknown'
    });
  }
});

// Prometheus metrics endpoint proxy
router.get('/metrics', async (req, res) => {
  try {
    const response = await axios.get(`${BOT_SERVICE_URL}/metrics`, {
      timeout: 10000
    });
    
    // Forward the prometheus metrics with proper content type
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(response.data);
  } catch (error) {
    console.error('Failed to fetch metrics:', error.message);
    
    res.status(error.response?.status || 500).json({
      error: 'Cannot fetch metrics from bot service'
    });
  }
});

// Version info endpoint
router.get('/version', async (req, res) => {
  try {
    const response = await axios.get(`${BOT_SERVICE_URL}/debug/version`, {
      timeout: 5000
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch version info:', error.message);
    
    res.status(error.response?.status || 500).json({
      error: 'Cannot fetch version info',
      version: 'unknown',
      gitCommit: 'unknown',
      deployTime: 'unknown'
    });
  }
});

// Simple metrics endpoint - proxy to bot
router.get('/metrics', async (req, res) => {
  try {
    const response = await axios.get(`${BOT_SERVICE_URL}/debug/metrics`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch metrics:', error.message);
    // Return empty metrics if bot is unreachable
    res.json({
      timestamp: new Date().toISOString(),
      messages: { total: 0, last_hour: 0, last_24h: 0, avg_response_time: 0 },
      users: { total: 0, active_today: 0, active_this_week: 0 },
      system: { memory_mb: 0 }
    });
  }
});

// Live metrics endpoint that aggregates multiple data sources
router.get('/live-metrics', async (req, res) => {
  try {
    // Fetch multiple endpoints in parallel
    const [health, systemStats, cacheStats, interventionStats] = await Promise.allSettled([
      axios.get(`${BOT_SERVICE_URL}/debug/health-comprehensive`, { timeout: 5000 }),
      axios.get(`${BOT_SERVICE_URL}/debug/system-stats`, { timeout: 5000 }),
      axios.get(`${BOT_SERVICE_URL}/debug/template-cache-stats`, { timeout: 5000 }),
      axios.get(`${BOT_SERVICE_URL}/debug/human-intervention-stats`, { timeout: 5000 })
    ]);
    
    const aggregatedData = {
      timestamp: new Date().toISOString(),
      health: health.status === 'fulfilled' ? health.value.data : null,
      systemStats: systemStats.status === 'fulfilled' ? systemStats.value.data : null,
      cacheStats: cacheStats.status === 'fulfilled' ? cacheStats.value.data : null,
      interventionStats: interventionStats.status === 'fulfilled' ? interventionStats.value.data : null,
      errors: []
    };
    
    // Collect any errors
    if (health.status === 'rejected') {
      aggregatedData.errors.push({ endpoint: 'health', error: health.reason.message });
    }
    if (systemStats.status === 'rejected') {
      aggregatedData.errors.push({ endpoint: 'systemStats', error: systemStats.reason.message });
    }
    if (cacheStats.status === 'rejected') {
      aggregatedData.errors.push({ endpoint: 'cacheStats', error: cacheStats.reason.message });
    }
    if (interventionStats.status === 'rejected') {
      aggregatedData.errors.push({ endpoint: 'interventionStats', error: interventionStats.reason.message });
    }
    
    res.json(aggregatedData);
  } catch (error) {
    console.error('Failed to fetch live metrics:', error.message);
    
    res.status(500).json({
      error: 'Failed to fetch live metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check for the monitoring API itself
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'monitoring-api',
    timestamp: new Date().toISOString(),
    botServiceUrl: BOT_SERVICE_URL
  });
});

module.exports = router;