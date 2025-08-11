# Config Directory - CLAUDE.md

Configuration files and settings for the ESSEN Facebook Messenger Bot.

## Structure

```
config/
└── config.js                # Main configuration file
```

## Configuration Management

### `config.js` - Main Configuration File
**Purpose**: Centralized configuration management for the entire application

**Key Sections**:

#### Environment Configuration
- Development vs Production settings
- Environment variable loading
- Feature flag management
- Debug mode configuration

#### Database Configuration
- PostgreSQL connection settings
- SQLite fallback configuration
- Connection pool settings
- Migration configuration

#### Facebook API Configuration
- API endpoint URLs
- Rate limiting settings
- Webhook configuration
- Message type handling

#### Gemini AI Configuration
- API endpoint configuration
- Model selection settings
- Temperature and creativity parameters
- Token limits and quotas

#### Server Configuration
- Port and host settings
- CORS configuration
- Middleware settings
- Static file serving

## Configuration Categories

### Database Settings
```javascript
database: {
  postgresql: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'essen_bot',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production',
    pool: {
      min: 2,
      max: 10,
      idle: 30000
    }
  },
  sqlite: {
    path: process.env.DB_PATH || './database/bot.db',
    options: {
      foreign_keys: true,
      journal_mode: 'WAL'
    }
  }
}
```

### Facebook Integration Settings
```javascript
facebook: {
  pageAccessToken: process.env.PAGE_ACCESS_TOKEN,
  verifyToken: process.env.VERIFY_TOKEN,
  appSecret: process.env.APP_SECRET,
  apiVersion: 'v18.0',
  baseUrl: 'https://graph.facebook.com',
  rateLimits: {
    messagesPerSecond: 10,
    burstLimit: 100
  },
  webhookEvents: [
    'messages',
    'messaging_postbacks',
    'messaging_referrals'
  ]
}
```

### Gemini AI Settings
```javascript
gemini: {
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-pro',
  baseUrl: 'https://generativelanguage.googleapis.com',
  generation: {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 1000,
    candidateCount: 1
  },
  safety: {
    harassment: 'BLOCK_MEDIUM_AND_ABOVE',
    hateSpeech: 'BLOCK_MEDIUM_AND_ABOVE',
    sexuallyExplicit: 'BLOCK_MEDIUM_AND_ABOVE',
    dangerousContent: 'BLOCK_MEDIUM_AND_ABOVE'
  }
}
```

### Server Settings
```javascript
server: {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }
}
```

### Application Settings
```javascript
app: {
  name: 'ESSEN Facebook Messenger Bot',
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  timezone: 'Asia/Singapore',
  language: {
    default: 'en',
    supported: ['en', 'zh-SG']
  },
  features: {
    analytics: true,
    appointments: true,
    adminInterface: true,
    knowledgeBase: true
  }
}
```

### Logging Configuration
```javascript
logging: {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? 'json' : 'combined',
  outputs: {
    console: true,
    file: process.env.NODE_ENV === 'production',
    database: process.env.ENABLE_DB_LOGGING === 'true'
  },
  rotation: {
    maxSize: '10m',
    maxFiles: 5
  }
}
```

## Environment-Specific Configurations

### Development Environment
- Verbose logging enabled
- Hot reloading configuration
- Debug mode features
- Local database settings
- Relaxed security settings

### Production Environment
- Optimized logging levels
- Security headers enabled
- SSL/TLS enforcement
- Connection pooling optimized
- Performance monitoring enabled

### Testing Environment
- Test database configuration
- Mock service endpoints
- Reduced timeouts
- Simplified authentication
- Enhanced error reporting

## Configuration Loading Strategy

### Environment Variable Priority
1. System environment variables
2. `.env` file variables
3. Default configuration values
4. Runtime overrides

### Validation and Error Handling
```javascript
function validateConfig() {
  const required = [
    'PAGE_ACCESS_TOKEN',
    'VERIFY_TOKEN', 
    'APP_SECRET',
    'GEMINI_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

### Dynamic Configuration Updates
- Hot reload for non-critical settings
- Graceful restart for database changes
- Feature flag toggling without restart
- Configuration validation on update

## Security Considerations

### Sensitive Data Protection
- Environment variables for secrets
- No hardcoded credentials
- Configuration file encryption option
- Audit logging for configuration changes

### Access Control
- Read-only configuration for application code
- Admin-only configuration updates
- Encrypted storage for sensitive settings
- Configuration backup and recovery

## Performance Settings

### Database Optimization
- Connection pool sizing
- Query timeout settings
- Index configuration hints
- Batch operation thresholds

### API Rate Limiting
- Facebook API compliance
- Gemini AI quota management
- User request throttling
- Burst limit configuration

### Caching Configuration
- Response cache TTL settings
- Memory cache size limits
- Redis configuration (if used)
- Cache invalidation strategies

## Monitoring and Observability

### Health Check Configuration
- Database connectivity checks
- External API availability
- Memory and CPU thresholds
- Response time monitoring

### Metrics Collection
- Performance counters
- Error rate tracking
- User engagement metrics
- System resource monitoring

### Alerting Configuration
- Error threshold alerts
- Performance degradation alerts
- System resource alerts
- Business metric alerts

## Usage Patterns

### Configuration Access
```javascript
const config = require('./config/config');

// Database connection
const dbConfig = config.database.postgresql;

// API settings
const facebookConfig = config.facebook;

// Feature flags
if (config.app.features.analytics) {
  // Enable analytics
}
```

### Environment Detection
```javascript
const isDevelopment = config.app.environment === 'development';
const isProduction = config.app.environment === 'production';

if (isDevelopment) {
  // Development-specific logic
}
```

### Configuration Validation
```javascript
function startApplication() {
  try {
    config.validate();
    // Start application
  } catch (error) {
    console.error('Configuration error:', error.message);
    process.exit(1);
  }
}
```