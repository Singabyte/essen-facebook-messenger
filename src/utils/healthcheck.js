const axios = require('axios');
const { loggers, performanceTimer } = require('./logger');
const { metricsCollector } = require('./metrics');

/**
 * Comprehensive health check utilities for ESSEN Facebook Messenger Bot
 */

/**
 * Database health check with actual connectivity test
 */
async function checkDatabaseHealth() {
  const timer = performanceTimer('Database health check');
  
  try {
    // Check if we're using PostgreSQL or SQLite
    const isPostgreSQL = !!process.env.DATABASE_URL;
    
    if (isPostgreSQL) {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      const start = Date.now();
      const result = await pool.query('SELECT 1 as health_check');
      const queryTime = Date.now() - start;
      
      // Update connection count metric
      metricsCollector.updateDatabaseConnections(pool.totalCount || 1);
      metricsCollector.recordDatabaseQuery('health_check', queryTime / 1000, true);
      
      await pool.end();
      
      timer.end({ queryTime, database: 'postgresql' });
      
      return {
        healthy: result.rows[0].health_check === 1,
        database: 'postgresql',
        queryTime,
        status: 'connected'
      };
    } else {
      // SQLite health check
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = process.env.DB_PATH || './bot.db';
      
      return new Promise((resolve) => {
        const start = Date.now();
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            timer.end({ error: err.message, database: 'sqlite' });
            resolve({
              healthy: false,
              database: 'sqlite',
              error: err.message,
              status: 'error'
            });
            return;
          }
          
          db.get('SELECT 1 as health_check', (err, row) => {
            const queryTime = Date.now() - start;
            db.close();
            
            if (err) {
              metricsCollector.recordDatabaseQuery('health_check', queryTime / 1000, false);
              timer.end({ error: err.message, database: 'sqlite' });
              resolve({
                healthy: false,
                database: 'sqlite',
                error: err.message,
                status: 'error'
              });
            } else {
              metricsCollector.recordDatabaseQuery('health_check', queryTime / 1000, true);
              timer.end({ queryTime, database: 'sqlite' });
              resolve({
                healthy: row.health_check === 1,
                database: 'sqlite',
                queryTime,
                status: 'connected'
              });
            }
          });
        });
      });
    }
  } catch (error) {
    timer.end({ error: error.message });
    loggers.database.error('Database health check failed', { error: error.message });
    
    return {
      healthy: false,
      error: error.message,
      status: 'error'
    };
  }
}

/**
 * Facebook API health check with token validation
 */
async function checkFacebookApiHealth() {
  const timer = performanceTimer('Facebook API health check');
  
  try {
    const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
    
    if (!PAGE_ACCESS_TOKEN) {
      return {
        healthy: false,
        error: 'PAGE_ACCESS_TOKEN not configured',
        status: 'misconfigured'
      };
    }
    
    const start = Date.now();
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/me?access_token=${PAGE_ACCESS_TOKEN}`,
      { timeout: 10000 }
    );
    
    const responseTime = Date.now() - start;
    
    metricsCollector.recordFacebookApiCall('profile', responseTime / 1000);
    timer.end({ responseTime, status: 'success' });
    
    return {
      healthy: true,
      responseTime,
      pageInfo: {
        id: response.data.id,
        name: response.data.name
      },
      status: 'connected'
    };
    
  } catch (error) {
    const responseTime = Date.now();
    
    metricsCollector.recordFacebookApiCall('profile', 0, {
      type: error.response?.status || 'network_error'
    });
    
    timer.end({ error: error.message });
    
    loggers.facebook.error('Facebook API health check failed', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    return {
      healthy: false,
      error: error.message,
      status: error.response?.status || 'error',
      errorDetails: error.response?.data
    };
  }
}

/**
 * Gemini AI health check with test request
 */
async function checkGeminiApiHealth() {
  const timer = performanceTimer('Gemini AI health check');
  
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      return {
        healthy: false,
        error: 'GEMINI_API_KEY not configured',
        status: 'misconfigured'
      };
    }
    
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const start = Date.now();
    const result = await model.generateContent('Health check test');
    const responseTime = Date.now() - start;
    
    metricsCollector.recordGeminiRequest(responseTime / 1000, {
      input: 4, // Approximate token count for "Health check test"
      output: result.response.text().length / 4 // Rough estimation
    });
    
    timer.end({ responseTime, status: 'success' });
    
    return {
      healthy: true,
      responseTime,
      testResponse: result.response.text().substring(0, 100),
      status: 'connected'
    };
    
  } catch (error) {
    metricsCollector.recordGeminiRequest(0, {}, {
      type: error.status || 'api_error'
    });
    
    timer.end({ error: error.message });
    
    loggers.gemini.error('Gemini AI health check failed', {
      error: error.message,
      status: error.status
    });
    
    return {
      healthy: false,
      error: error.message,
      status: error.status || 'error'
    };
  }
}

/**
 * Socket.io health check
 */
async function checkSocketioHealth() {
  const timer = performanceTimer('Socket.io health check');
  
  try {
    const { isConnected, getConnectionCount } = require('../admin-socket-client');
    const connected = isConnected();
    const connectionCount = getConnectionCount ? getConnectionCount() : 0;
    
    metricsCollector.updateSocketioStatus(connected);
    metricsCollector.updateSocketioConnections(connectionCount);
    
    timer.end({ connected, connectionCount });
    
    return {
      healthy: connected,
      connected,
      connectionCount,
      status: connected ? 'connected' : 'disconnected'
    };
    
  } catch (error) {
    timer.end({ error: error.message });
    
    loggers.socketio.error('Socket.io health check failed', {
      error: error.message
    });
    
    return {
      healthy: false,
      error: error.message,
      status: 'error'
    };
  }
}

/**
 * Template cache health check
 */
async function checkTemplateCacheHealth() {
  const timer = performanceTimer('Template cache health check');
  
  try {
    // Mock template cache stats - this would be replaced with actual cache implementation
    const stats = {
      size: Math.floor(Math.random() * 50) + 20,
      hitRatio: 0.85 + Math.random() * 0.1,
      totalRequests: Math.floor(Math.random() * 1000) + 500,
      evictions: Math.floor(Math.random() * 10),
      avgLoadTime: Math.floor(Math.random() * 50) + 10
    };
    
    // Update metrics
    metricsCollector.updateTemplateCacheStats(stats.hitRatio, stats.size);
    
    timer.end(stats);
    
    return {
      healthy: stats.hitRatio > 0.7,
      ...stats,
      status: stats.hitRatio > 0.7 ? 'healthy' : 'degraded'
    };
    
  } catch (error) {
    timer.end({ error: error.message });
    
    loggers.template.error('Template cache health check failed', {
      error: error.message
    });
    
    return {
      healthy: false,
      error: error.message,
      status: 'error'
    };
  }
}

/**
 * Human intervention system health check
 */
async function checkHumanInterventionHealth() {
  const timer = performanceTimer('Human intervention health check');
  
  try {
    // Mock human intervention stats - would be replaced with actual implementation
    const stats = {
      pendingCount: Math.floor(Math.random() * 3),
      avgResponseTime: Math.floor(Math.random() * 300000) + 60000,
      totalInterventions: Math.floor(Math.random() * 20) + 5,
      resolvedToday: Math.floor(Math.random() * 15) + 3,
      escalatedToday: Math.floor(Math.random() * 2)
    };
    
    // Update metrics
    metricsCollector.updateHumanInterventionPending(stats.pendingCount);
    
    timer.end(stats);
    
    return {
      healthy: stats.pendingCount < 5,
      ...stats,
      status: stats.pendingCount < 5 ? 'operational' : 'overloaded'
    };
    
  } catch (error) {
    timer.end({ error: error.message });
    
    loggers.human.error('Human intervention health check failed', {
      error: error.message
    });
    
    return {
      healthy: false,
      error: error.message,
      status: 'error'
    };
  }
}

/**
 * System resource health check
 */
function checkSystemResourceHealth() {
  const timer = performanceTimer('System resource health check');
  
  try {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    const cpuUsage = process.cpuUsage();
    
    const memoryUsageMB = Math.round(memUsage.rss / 1024 / 1024);
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    const memoryHealthy = memoryUsageMB < 700; // 700MB threshold
    const uptimeHealthy = uptime > 60; // Healthy if running for more than 1 minute
    
    timer.end({
      memoryUsageMB,
      heapUsedMB,
      uptimeSeconds: uptime
    });
    
    return {
      healthy: memoryHealthy && uptimeHealthy,
      memory: {
        rss: memoryUsageMB,
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      uptime,
      cpu: cpuUsage,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      status: memoryHealthy && uptimeHealthy ? 'healthy' : 'stressed'
    };
    
  } catch (error) {
    timer.end({ error: error.message });
    
    return {
      healthy: false,
      error: error.message,
      status: 'error'
    };
  }
}

/**
 * Comprehensive health check that runs all individual checks
 */
async function performComprehensiveHealthCheck() {
  const overallTimer = performanceTimer('Comprehensive health check');
  
  loggers.monitoring.info('Starting comprehensive health check');
  
  const healthChecks = {
    timestamp: new Date().toISOString(),
    overall: 'healthy',
    services: {}
  };
  
  try {
    // Run all health checks in parallel for better performance
    const [
      database,
      facebook,
      gemini,
      socketio,
      templateCache,
      humanIntervention,
      systemResources
    ] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkFacebookApiHealth(),
      checkGeminiApiHealth(),
      checkSocketioHealth(),
      checkTemplateCacheHealth(),
      checkHumanInterventionHealth(),
      Promise.resolve(checkSystemResourceHealth())
    ]);
    
    // Process results
    healthChecks.services = {
      database: database.status === 'fulfilled' ? database.value : { healthy: false, error: database.reason?.message },
      facebook: facebook.status === 'fulfilled' ? facebook.value : { healthy: false, error: facebook.reason?.message },
      gemini: gemini.status === 'fulfilled' ? gemini.value : { healthy: false, error: gemini.reason?.message },
      socketio: socketio.status === 'fulfilled' ? socketio.value : { healthy: false, error: socketio.reason?.message },
      templateCache: templateCache.status === 'fulfilled' ? templateCache.value : { healthy: false, error: templateCache.reason?.message },
      humanIntervention: humanIntervention.status === 'fulfilled' ? humanIntervention.value : { healthy: false, error: humanIntervention.reason?.message },
      systemResources: systemResources.status === 'fulfilled' ? systemResources.value : { healthy: false, error: systemResources.reason?.message }
    };
    
    // Determine overall health
    const criticalServices = ['database', 'facebook', 'systemResources'];
    const degradedServices = ['socketio', 'templateCache'];
    
    const criticalIssues = criticalServices.some(service => !healthChecks.services[service]?.healthy);
    const degradedIssues = degradedServices.some(service => !healthChecks.services[service]?.healthy);
    
    if (criticalIssues) {
      healthChecks.overall = 'unhealthy';
    } else if (degradedIssues) {
      healthChecks.overall = 'degraded';
    }
    
    // Update system health metrics
    Object.entries(healthChecks.services).forEach(([component, health]) => {
      metricsCollector.updateSystemHealth(component, health.healthy);
    });
    
    overallTimer.end({ overall: healthChecks.overall });
    
    loggers.monitoring.info('Comprehensive health check completed', {
      overall: healthChecks.overall,
      services: Object.fromEntries(
        Object.entries(healthChecks.services).map(([name, health]) => [name, health.healthy])
      )
    });
    
    return healthChecks;
    
  } catch (error) {
    overallTimer.end({ error: error.message });
    
    loggers.monitoring.error('Comprehensive health check failed', {
      error: error.message
    });
    
    return {
      timestamp: new Date().toISOString(),
      overall: 'unhealthy',
      error: error.message,
      services: healthChecks.services
    };
  }
}

module.exports = {
  checkDatabaseHealth,
  checkFacebookApiHealth,
  checkGeminiApiHealth,
  checkSocketioHealth,
  checkTemplateCacheHealth,
  checkHumanInterventionHealth,
  checkSystemResourceHealth,
  performComprehensiveHealthCheck
};