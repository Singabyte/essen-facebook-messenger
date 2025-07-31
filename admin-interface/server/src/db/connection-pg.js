const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// For production environments with self-signed certificates
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// PostgreSQL connection with proper SSL configuration for DigitalOcean
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.NODE_ENV === 'production' ? {
    // For DigitalOcean managed databases, disable certificate verification completely
    // This is safe for managed services within the same cloud infrastructure
    rejectUnauthorized: false,
    requestCert: false,
    agent: false
  } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Application name for monitoring
  application_name: 'essen-admin-interface'
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err);
  } else {
    console.log('Admin interface connected to PostgreSQL database');
  }
});

// Initialize admin tables (tables should already exist from main bot)
async function initAdminTables() {
  try {
    // Check if admin user exists
    const adminCheck = await pool.query('SELECT COUNT(*) as count FROM admin_users');
    
    if (adminCheck.rows[0].count === 0) {
      console.log('No admin users found, creating default admin...');
      const hashedPassword = await bcrypt.hash('hello123', 10);
      
      await pool.query(
        'INSERT INTO admin_users (username, password) VALUES ($1, $2)',
        ['admin', hashedPassword]
      );
      console.log('✅ Default admin user created (username: admin, password: hello123)');
    } else {
      console.log(`Found ${adminCheck.rows[0].count} admin user(s)`);
    }
  } catch (err) {
    console.error('Error in initAdminTables:', err);
  }
}

// Helper to convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
function convertSqliteToPostgres(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

// Database helper functions
const dbHelpers = {
  // Run a query that returns lastID
  run: async (sql, params = []) => {
    try {
      // Convert SQLite style queries to PostgreSQL
      let pgSql = convertSqliteToPostgres(sql);
      
      // Handle INSERT queries with RETURNING
      if (sql.toLowerCase().includes('insert into') && !sql.toLowerCase().includes('returning')) {
        pgSql = pgSql + ' RETURNING id';
      }
      
      const result = await pool.query(pgSql, params);
      
      // Return in SQLite-compatible format
      return {
        id: result.rows[0]?.id || null,
        changes: result.rowCount
      };
    } catch (err) {
      throw err;
    }
  },
  
  // Get a single row
  get: async (sql, params = []) => {
    try {
      const pgSql = convertSqliteToPostgres(sql);
      const result = await pool.query(pgSql, params);
      return result.rows[0] || null;
    } catch (err) {
      throw err;
    }
  },
  
  // Get all rows
  all: async (sql, params = []) => {
    try {
      const pgSql = convertSqliteToPostgres(sql);
      const result = await pool.query(pgSql, params);
      return result.rows;
    } catch (err) {
      throw err;
    }
  },
  
  // Log audit event
  logAudit: async (adminId, action, resource, details = {}) => {
    try {
      const sql = 'INSERT INTO audit_logs (admin_id, action, resource, details) VALUES (?, ?, ?, ?)';
      const pgSql = convertSqliteToPostgres(sql);
      await pool.query(pgSql, [adminId, action, resource, JSON.stringify(details)]);
    } catch (err) {
      console.error('Error logging audit:', err);
    }
  }
};

module.exports = { pool: pool, db: pool, initAdminTables, ...dbHelpers };