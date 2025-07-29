const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, process.env.DB_PATH || '../../../../database/bot.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database for admin interface');
  }
});

// Initialize admin tables
function initAdminTables() {
  db.serialize(() => {
    // Admin users table
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`, (err) => {
      if (err) console.error('Error creating admin_users table:', err);
      else console.log('Admin users table ready');
    });
    
    // Audit logs table
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      action TEXT NOT NULL,
      resource TEXT,
      details JSON,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(admin_id) REFERENCES admin_users(id)
    )`, (err) => {
      if (err) console.error('Error creating audit_logs table:', err);
      else console.log('Audit logs table ready');
    });
  });
}

// Database helper functions
const dbHelpers = {
  // Run a query that doesn't return data
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  
  // Get a single row
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  
  // Get all rows
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  
  // Log audit event
  logAudit: async (adminId, action, resource, details = {}) => {
    const sql = `INSERT INTO audit_logs (admin_id, action, resource, details) VALUES (?, ?, ?, ?)`;
    return dbHelpers.run(sql, [adminId, action, resource, JSON.stringify(details)]);
  }
};

module.exports = { db, initAdminTables, ...dbHelpers };