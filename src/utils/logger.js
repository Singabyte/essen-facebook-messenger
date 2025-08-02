const winston = require('winston');
const path = require('path');
const correlationId = require('correlation-id');

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      correlationId: correlationId.getId(),
      service: 'essen-bot',
      environment: process.env.NODE_ENV || 'development',
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'essen-facebook-bot',
    version: '1.0.0'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Application specific logs
    new winston.transports.File({
      filename: path.join(logsDir, 'bot-activity.log'),
      level: 'info',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 7,
      tailable: true
    }),
    
    // Performance logs
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      level: 'info',
      maxsize: 25 * 1024 * 1024, // 25MB
      maxFiles: 5,
      tailable: true
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, correlationId: cId, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}] ${cId ? `[${cId}] ` : ''}${message} ${metaStr}`;
      })
    )
  }));
}

// Custom logging methods for different categories
const createCategoryLogger = (category) => ({
  error: (message, meta = {}) => logger.error(message, { category, ...meta }),
  warn: (message, meta = {}) => logger.warn(message, { category, ...meta }),
  info: (message, meta = {}) => logger.info(message, { category, ...meta }),
  debug: (message, meta = {}) => logger.debug(message, { category, ...meta })
});

// Specialized loggers for different components
const loggers = {
  bot: createCategoryLogger('bot'),
  webhook: createCategoryLogger('webhook'),
  database: createCategoryLogger('database'),
  facebook: createCategoryLogger('facebook-api'),
  gemini: createCategoryLogger('gemini-ai'),
  socketio: createCategoryLogger('socketio'),
  template: createCategoryLogger('template-cache'),
  human: createCategoryLogger('human-intervention'),
  performance: createCategoryLogger('performance'),
  security: createCategoryLogger('security'),
  monitoring: createCategoryLogger('monitoring')
};

// Performance timing utility
const performanceTimer = (label) => {
  const startTime = process.hrtime.bigint();
  
  return {
    end: (meta = {}) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      loggers.performance.info(`${label} completed`, {
        duration,
        durationMs: Math.round(duration * 100) / 100,
        ...meta
      });
      
      return duration;
    }
  };
};

// Metrics logging helper
const logMetric = (name, value, tags = {}) => {
  logger.info('METRIC', {
    metric: name,
    value,
    tags,
    timestamp: new Date().toISOString()
  });
};

// Error logging with context
const logError = (error, context = {}) => {
  logger.error('Application error', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context,
    correlationId: correlationId.getId()
  });
};

// Business event logging
const logBusinessEvent = (event, data = {}) => {
  logger.info('BUSINESS_EVENT', {
    event,
    data,
    timestamp: new Date().toISOString(),
    correlationId: correlationId.getId()
  });
};

// Security event logging
const logSecurityEvent = (event, details = {}) => {
  loggers.security.warn('SECURITY_EVENT', {
    event,
    details,
    timestamp: new Date().toISOString(),
    correlationId: correlationId.getId()
  });
};

module.exports = {
  logger,
  loggers,
  performanceTimer,
  logMetric,
  logError,
  logBusinessEvent,
  logSecurityEvent
};