module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // Facebook configuration
  facebook: {
    pageAccessToken: process.env.PAGE_ACCESS_TOKEN,
    verifyToken: process.env.VERIFY_TOKEN,
    appSecret: process.env.APP_SECRET,
    apiVersion: 'v18.0'
  },
  
  // Gemini configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    maxTokens: 2048,
    temperature: 0.7
  },
  
  // Database configuration
  database: {
    path: process.env.DB_PATH || './database/bot.db'
  },
  
  // Conversation settings
  conversation: {
    historyLimit: 5,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    typingDelay: 1000 // 1 second
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30 // 30 requests per minute per user
  },
  
  // Logging
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: 'json'
  }
};