// Use the centralized database configuration
const { pool, testConnection } = require('./db-config');

// Initialize database tables
async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    // Test connection first
    await testConnection();
    
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        profile_pic TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        message TEXT,
        response TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Database functions
const db = {
  // Save or update user
  saveUser: async (userId, userData) => {
    try {
      const query = `
        INSERT INTO users (id, name, profile_pic, last_interaction)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          profile_pic = EXCLUDED.profile_pic,
          last_interaction = CURRENT_TIMESTAMP
      `;
      await pool.query(query, [userId, userData.name || 'User', userData.profile_pic || null]);
    } catch (err) {
      console.error('Error saving user:', err);
    }
  },

  // Get user by ID
  getUser: async (userId) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      return result.rows[0];
    } catch (err) {
      console.error('Error getting user:', err);
      return null;
    }
  },

  // Save conversation
  saveConversation: async (userId, message, response) => {
    try {
      const query = `
        INSERT INTO conversations (user_id, message, response)
        VALUES ($1, $2, $3)
      `;
      await pool.query(query, [userId, message, response]);
    } catch (err) {
      console.error('Error saving conversation:', err);
    }
  },

  // Get conversation history
  getConversationHistory: async (userId, limit = 10) => {
    try {
      const query = `
        SELECT message, response, timestamp
        FROM conversations
        WHERE user_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `;
      const result = await pool.query(query, [userId, limit]);
      return result.rows.reverse();
    } catch (err) {
      console.error('Error getting conversation history:', err);
      return [];
    }
  },
  
  // Get bot status for a user
  getBotStatusForUser: async (userId) => {
    try {
      const query = `
        SELECT bot_enabled, admin_takeover 
        FROM users 
        WHERE id = $1
      `;
      const result = await pool.query(query, [userId]);
      
      if (result.rows.length > 0) {
        return {
          bot_enabled: result.rows[0].bot_enabled !== false, // Default to true if null
          admin_takeover: result.rows[0].admin_takeover === true
        };
      }
      
      // Default to bot enabled for new users
      return {
        bot_enabled: true,
        admin_takeover: false
      };
    } catch (err) {
      console.error('Error getting bot status:', err);
      // Default to bot enabled on error
      return {
        bot_enabled: true,
        admin_takeover: false
      };
    }
  }
};

module.exports = {
  initDatabase,
  db
};