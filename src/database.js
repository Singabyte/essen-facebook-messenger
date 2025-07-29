const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './database/bot.db';
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
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
  }
};

module.exports = { db, initDatabase, ...dbHelpers };