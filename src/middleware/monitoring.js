const correlationId = require('correlation-id');
const { v4: uuidv4 } = require('uuid');
const { loggers, performanceTimer } = require('../utils/logger');
const { metricsCollector } = require('../utils/metrics');
const rateLimit = require('express-rate-limit');

/**
 * Correlation ID middleware - adds unique ID to each request for tracing
 */
const correlationIdMiddleware = (req, res, next) => {
  const id = req.headers['x-correlation-id'] || uuidv4();
  correlationId.withId(id, () => {
    req.correlationId = id;
    res.setHeader('X-Correlation-ID', id);
    
    loggers.monitoring.debug('Request started', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      correlationId: id
    });
    
    next();
  });
};

/**
 * Performance monitoring middleware - tracks request duration and metrics
 */
const performanceMiddleware = (req, res, next) => {
  const timer = performanceTimer(`${req.method} ${req.route?.path || req.path}`);
  const startTime = Date.now();
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const route = req.route?.path || req.path;
    
    // Record metrics
    metricsCollector.recordHttpRequest(
      req.method,
      route,
      res.statusCode.toString(),
      duration
    );
    
    // Log performance data
    loggers.performance.info('Request completed', {
      method: req.method,
      route,
      statusCode: res.statusCode,
      duration: Math.round(duration * 1000), // Log in milliseconds
      correlationId: req.correlationId,
      responseSize: res.get('Content-Length') || 0
    });
    
    timer.end({
      statusCode: res.statusCode,
      responseSize: res.get('Content-Length') || 0
    });
    
    originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Error handling middleware for monitoring
 */
const errorMonitoringMiddleware = (err, req, res, next) => {
  loggers.bot.error('Request error', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    request: {
      method: req.method,
      url: req.url,
      correlationId: req.correlationId,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  });
  
  // Record error metrics
  metricsCollector.recordHttpRequest(
    req.method,
    req.route?.path || req.path,
    '500',
    0
  );
  
  next(err);
};

/**
 * Security monitoring middleware
 */
const securityMiddleware = (req, res, next) => {
  // Monitor suspicious patterns
  const suspiciousPatterns = [
    /\.\./,                    // Path traversal
    /<script/i,               // XSS attempts
    /union.*select/i,         // SQL injection
    /javascript:/i,           // JS injection
    /data:.*base64/i          // Data URI attacks
  ];
  
  const url = req.url.toLowerCase();
  const userAgent = req.get('User-Agent') || '';
  
  // Check for suspicious patterns
  suspiciousPatterns.forEach(pattern => {
    if (pattern.test(url) || pattern.test(userAgent)) {
      loggers.security.warn('Suspicious request detected', {
        pattern: pattern.toString(),
        url: req.url,
        userAgent,
        ip: req.ip,
        correlationId: req.correlationId
      });
    }
  });
  
  // Monitor rate limiting triggers
  if (req.rateLimit) {
    if (req.rateLimit.remaining < 5) {
      loggers.security.info('Rate limit approaching', {
        remaining: req.rateLimit.remaining,
        total: req.rateLimit.total,
        ip: req.ip,
        correlationId: req.correlationId
      });
    }
  }
  
  next();
};

/**
 * Health check monitoring - updates system health metrics
 */
const healthCheckMiddleware = async (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/debug/')) {
    try {
      // Update basic service health
      metricsCollector.updateSystemHealth('api', true);
      
      // Check and update component health
      const healthChecks = {
        database: await checkDatabaseHealth(),
        socketio: await checkSocketioHealth(),
        facebook: await checkFacebookHealth(),
        gemini: await checkGeminiHealth()
      };
      
      Object.entries(healthChecks).forEach(([component, healthy]) => {
        metricsCollector.updateSystemHealth(component, healthy);
      });
      
    } catch (error) {
      loggers.monitoring.error('Health check failed', {
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }
  
  next();
};

/**
 * Component health check functions
 */
async function checkDatabaseHealth() {
  try {
    // This would be implemented with actual database ping
    // For now, return true if DATABASE_URL exists
    return !!process.env.DATABASE_URL;
  } catch (error) {
    return false;
  }
}

async function checkSocketioHealth() {
  try {
    const { isConnected } = require('../admin-socket-client');
    return isConnected();
  } catch (error) {
    return false;
  }
}

async function checkFacebookHealth() {
  try {
    // Check if all required Facebook env vars are present
    return !!(process.env.PAGE_ACCESS_TOKEN && 
              process.env.VERIFY_TOKEN && 
              process.env.APP_SECRET);
  } catch (error) {
    return false;
  }
}

async function checkGeminiHealth() {
  try {
    return !!process.env.GEMINI_API_KEY;
  } catch (error) {
    return false;
  }
}

/**
 * Rate limiting with monitoring
 */
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      loggers.security.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.correlationId,
        limit: options.max,
        windowMs: options.windowMs
      });
      
      res.status(options.statusCode).json({
        error: options.message,
        retryAfter: Math.round(options.windowMs / 1000)
      });
    }
  });
};

/**
 * Webhook security monitoring - specific for Facebook webhooks
 */
const webhookSecurityMiddleware = (req, res, next) => {
  const signature = req.get('X-Hub-Signature-256');
  const userAgent = req.get('User-Agent') || '';
  
  loggers.webhook.info('Webhook request received', {
    hasSignature: !!signature,
    userAgent,
    contentLength: req.get('Content-Length'),
    ip: req.ip,
    correlationId: req.correlationId
  });
  
  // Log suspicious webhook attempts
  if (!signature) {
    loggers.security.warn('Webhook request without signature', {
      ip: req.ip,
      userAgent,
      correlationId: req.correlationId
    });
  }
  
  if (!userAgent.includes('facebookplatform')) {
    loggers.security.warn('Webhook request from non-Facebook user agent', {
      userAgent,
      ip: req.ip,
      correlationId: req.correlationId
    });
  }
  
  next();
};

module.exports = {
  correlationIdMiddleware,
  performanceMiddleware,
  errorMonitoringMiddleware,
  securityMiddleware,
  healthCheckMiddleware,
  webhookSecurityMiddleware,
  createRateLimiter
};