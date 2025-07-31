const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false,
    require: true 
  } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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

// Database helper functions
const dbHelpers = {
  // Run a query that returns lastID
  run: async (sql, params = []) => {
    try {
      // Convert SQLite style queries to PostgreSQL
      let pgSql = sql;
      
      // Handle INSERT queries with RETURNING
      if (sql.toLowerCase().includes('insert into') && !sql.toLowerCase().includes('returning')) {
        pgSql = sql + ' RETURNING id';
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
      const result = await pool.query(sql, params);
      return result.rows[0] || null;
    } catch (err) {
      throw err;
    }
  },
  
  // Get all rows
  all: async (sql, params = []) => {
    try {
      const result = await pool.query(sql, params);
      return result.rows;
    } catch (err) {
      throw err;
    }
  },
  
  // Log audit event
  logAudit: async (adminId, action, resource, details = {}) => {
    try {
      await pool.query(
        'INSERT INTO audit_logs (admin_id, action, resource, details) VALUES ($1, $2, $3, $4)',
        [adminId, action, resource, JSON.stringify(details)]
      );
    } catch (err) {
      console.error('Error logging audit:', err);
    }
  }
};

module.exports = { pool: pool, db: pool, initAdminTables, ...dbHelpers };