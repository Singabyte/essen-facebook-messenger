const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use absolute path from env or resolve relative path
const dbPath = process.env.DB_PATH 
  ? process.env.DB_PATH  // Use absolute path from environment
  : path.resolve(__dirname, '../../../../database/bot.db'); // Fallback to relative path

console.log('Attempting to connect to database at:', dbPath);

// Open database with specific mode to handle concurrent access
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    console.error('Database path:', dbPath);
    console.error('Working directory:', process.cwd());
    console.error('Error code:', err.code);
    console.error('Error errno:', err.errno);
  } else {
    console.log('Connected to SQLite database for admin interface');
    console.log('Database path:', dbPath);
    
    // Enable WAL mode for better concurrent access
    db.run('PRAGMA journal_mode=WAL', (err) => {
      if (err) {
        console.error('Error setting WAL mode:', err);
      } else {
        console.log('WAL mode enabled for better concurrent access');
      }
    });
    
    // Set busy timeout to wait if database is locked
    db.run('PRAGMA busy_timeout=10000', (err) => {
      if (err) {
        console.error('Error setting busy timeout:', err);
      } else {
        console.log('Busy timeout set to 10 seconds');
      }
    });
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