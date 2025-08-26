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
        platform TEXT DEFAULT 'facebook',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add platform column if it doesn't exist (for existing deployments)
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'facebook'
    `).catch(err => {
      // Column might already exist, that's okay
      console.log('Platform column might already exist in users table');
    });
    
    // Conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        message TEXT,
        response TEXT,
        platform TEXT DEFAULT 'facebook',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add platform column if it doesn't exist (for existing deployments)
    await pool.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'facebook'
    `).catch(err => {
      // Column might already exist, that's okay
      console.log('Platform column might already exist in conversations table');
    });
    
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Database functions
const db = {
  // Save or update user
  saveUser: async (userId, userData, platform = 'facebook') => {
    try {
      const query = `
        INSERT INTO users (id, name, profile_pic, platform, last_interaction)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          profile_pic = EXCLUDED.profile_pic,
          platform = EXCLUDED.platform,
          last_interaction = CURRENT_TIMESTAMP
      `;
      await pool.query(query, [
        userId, 
        userData.name || 'User', 
        userData.profile_pic || null,
        platform
      ]);
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
  saveConversation: async (userId, message, response, platform = 'facebook', adminDisabled = false) => {
    try {
      const query = `
        INSERT INTO conversations (user_id, message, response, platform)
        VALUES ($1, $2, $3, $4)
      `;
      await pool.query(query, [userId, message, response, platform]);
    } catch (err) {
      console.error('Error saving conversation:', err);
    }
  },

  // Get conversation history
  getConversationHistory: async (userId, limit = 10, platform = null) => {
    try {
      let query;
      let params;
      
      if (platform) {
        // Filter by platform if specified
        query = `
          SELECT message, response, platform, timestamp
          FROM conversations
          WHERE user_id = $1 AND platform = $2
          ORDER BY timestamp DESC
          LIMIT $3
        `;
        params = [userId, platform, limit];
      } else {
        // Get all conversations regardless of platform
        query = `
          SELECT message, response, platform, timestamp
          FROM conversations
          WHERE user_id = $1
          ORDER BY timestamp DESC
          LIMIT $2
        `;
        params = [userId, limit];
      }
      
      const result = await pool.query(query, params);
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