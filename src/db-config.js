/**
 * Database configuration for DigitalOcean managed PostgreSQL
 * Handles SSL certificate issues with managed databases
 */

const { Pool } = require('pg');

// Parse DATABASE_URL if needed
function parseConnectionString(connectionString) {
  if (!connectionString) return null;
  
  try {
    const url = new URL(connectionString);
    return {
      user: url.username,
      password: url.password,
      host: url.hostname,
      port: url.port || 5432,
      database: url.pathname.slice(1),
      // Force SSL for DigitalOcean
      ssl: {
        rejectUnauthorized: false,
        require: true
      }
    };
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error);
    return null;
  }
}

// Create pool configuration
function createPoolConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  // For production, parse the connection string and force SSL
  if (isProduction) {
    // Set Node.js to accept self-signed certificates
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    const parsedConfig = parseConnectionString(databaseUrl);
    if (parsedConfig) {
      return {
        ...parsedConfig,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        application_name: 'essen-facebook-bot'
      };
    }
  }
  
  // Fallback to connection string with SSL config
  return {
    connectionString: databaseUrl,
    ssl: isProduction ? {
      rejectUnauthorized: false,
      require: true,
      requestCert: false
    } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    application_name: 'essen-facebook-bot'
  };
}

// Create the pool
let pool;
try {
  const config = createPoolConfig();
  console.log('Creating database pool with config:', {
    ...config,
    password: config.password ? '***' : undefined,
    connectionString: config.connectionString ? '***' : undefined
  });
  pool = new Pool(config);
} catch (error) {
  console.error('Failed to create database pool:', error);
  throw error;
}

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Test the connection
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as now, current_database() as db');
    console.log('Database connection successful:', {
      time: result.rows[0].now,
      database: result.rows[0].db
    });
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  createPoolConfig
};