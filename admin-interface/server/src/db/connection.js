// Check if we should use PostgreSQL or SQLite
const usePostgreSQL = !!process.env.DATABASE_URL;

if (usePostgreSQL) {
  // Use PostgreSQL
  console.log('Admin interface using PostgreSQL database');
  module.exports = require('./connection-pg');
} else {
  // Use SQLite (original implementation)
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const fs = require('fs');

  // Use absolute path from env or resolve relative path
  const dbPath = process.env.DB_PATH 
    ? process.env.DB_PATH  // Use absolute path from environment
    : path.resolve(__dirname, '../../../../database/bot.db'); // Fallback to relative path

  // Ensure database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Created database directory:', dbDir);
  }

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
    // Create main bot tables first (in case they don't exist)
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      profile_pic TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      message TEXT,
      response TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      appointment_date TEXT,
      appointment_time TEXT,
      name TEXT,
      phone TEXT,
      email TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      user_id TEXT,
      data JSON,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      preferences JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    
    // Admin users table
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`, async (err) => {
      if (err) {
        console.error('Error creating admin_users table:', err);
      } else {
        console.log('Admin users table ready');
        
        // Auto-create default admin user if none exists
        db.get('SELECT COUNT(*) as count FROM admin_users', async (err, row) => {
          if (err) {
            console.error('Error checking admin users:', err);
            return;
          }
          
          if (row.count === 0) {
            console.log('No admin users found, creating default admin...');
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('hello123', 10);
            
            db.run(
              'INSERT INTO admin_users (username, password) VALUES (?, ?)',
              ['admin', hashedPassword],
              function(err) {
                if (err) {
                  console.error('Error creating default admin:', err);
                } else {
                  console.log('✅ Default admin user created (username: admin, password: hello123)');
                }
              }
            );
          } else {
            console.log(`Found ${row.count} admin user(s)`);
          }
        });
      }
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
    
    // Promotion templates table
    db.run(`CREATE TABLE IF NOT EXISTS promotion_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      quick_replies JSON,
      media_url TEXT,
      media_type TEXT,
      variables JSON,
      trigger_keywords JSON,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating promotion_templates table:', err);
      else console.log('Promotion templates table ready');
    });
    
    // Template usage tracking table
    db.run(`CREATE TABLE IF NOT EXISTS template_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      user_id TEXT,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(template_id) REFERENCES promotion_templates(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('Error creating template_usage table:', err);
      else console.log('Template usage table ready');
    });
    
    // Bot configuration table
    db.run(`CREATE TABLE IF NOT EXISTS bot_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_name TEXT UNIQUE NOT NULL,
      value TEXT,
      default_value TEXT,
      data_type TEXT DEFAULT 'string',
      category TEXT DEFAULT 'general',
      description TEXT,
      is_public BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating bot_config table:', err);
      else console.log('Bot configuration table ready');
    });
    
    // FAQs table
    db.run(`CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT,
      keywords JSON,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating faqs table:', err);
      else console.log('FAQs table ready');
    });
    
    // FAQ usage tracking table
    db.run(`CREATE TABLE IF NOT EXISTS faq_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faq_id INTEGER,
      user_id TEXT,
      asked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(faq_id) REFERENCES faqs(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('Error creating faq_usage table:', err);
      else console.log('FAQ usage table ready');
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
}