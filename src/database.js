// Check if we should use PostgreSQL or SQLite
const usePostgreSQL = !!process.env.DATABASE_URL;

if (usePostgreSQL) {
  // Use PostgreSQL
  console.log('Using PostgreSQL database');
  module.exports = require('./database-pg');
} else {
  // Use SQLite (original implementation)
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const fs = require('fs');

  const dbPath = process.env.DB_PATH || './database/bot.db';
  const dbDir = path.dirname(dbPath);

  // Ensure database directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.error('Error opening database:', err);
    } else {
      console.log('Connected to SQLite database');
      
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

function initDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      profile_pic TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating users table:', err);
      else console.log('Users table ready');
    });
    
    // Conversations table
    db.run(`CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      message TEXT,
      response TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('Error creating conversations table:', err);
      else console.log('Conversations table ready');
    });
    
    // User preferences table
    db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      preferences JSON,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('Error creating user_preferences table:', err);
      else console.log('User preferences table ready');
    });
    
    // Analytics table
    db.run(`CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      user_id TEXT,
      data JSON,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating analytics table:', err);
      else console.log('Analytics table ready');
    });
    
    // Appointments table
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      facebook_name TEXT,
      appointment_date TEXT,
      appointment_time TEXT,
      phone_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
      if (err) console.error('Error creating appointments table:', err);
      else console.log('Appointments table ready');
    });
  });
}

// Database helper functions
const dbHelpers = {
  // User operations
  createOrUpdateUser: (userId, name = null, profilePic = null) => {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO users (id, name, profile_pic) 
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = COALESCE(?, name),
          profile_pic = COALESCE(?, profile_pic),
          last_interaction = CURRENT_TIMESTAMP
      `;
      db.run(query, [userId, name, profilePic, name, profilePic], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // Get user info
  getUser: (userId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // Save conversation
  saveConversation: (userId, message, response) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)',
        [userId, message, response],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  // Get conversation history
  getConversationHistory: (userId, limit = 10) => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  // Save user preferences
  saveUserPreferences: (userId, preferences) => {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO user_preferences (user_id, preferences) 
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          preferences = ?,
          updated_at = CURRENT_TIMESTAMP
      `;
      const prefsJson = JSON.stringify(preferences);
      db.run(query, [userId, prefsJson, prefsJson], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // Get user preferences
  getUserPreferences: (userId) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT preferences FROM user_preferences WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? JSON.parse(row.preferences) : null);
        }
      );
    });
  },

  // Log analytics event
  logAnalytics: (eventType, userId, data) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO analytics (event_type, user_id, data) VALUES (?, ?, ?)',
        [eventType, userId, JSON.stringify(data)],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  // Save appointment
  saveAppointment: (userId, facebookName, appointmentDate, appointmentTime, phoneNumber = null) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO appointments (user_id, facebook_name, appointment_date, appointment_time, phone_number) VALUES (?, ?, ?, ?, ?)',
        [userId, facebookName, appointmentDate, appointmentTime, phoneNumber],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  // Get user appointments
  getUserAppointments: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM appointments WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
};

  module.exports = { db, initDatabase, ...dbHelpers };
}