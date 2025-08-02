const { Pool } = require('pg');
const fs = require('fs');
const { adminEvents } = require('./admin-socket-client');

// Enhanced PostgreSQL connection configuration for DigitalOcean
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? {
    // For DigitalOcean managed databases, we need to accept self-signed certificates
    rejectUnauthorized: false
  } : false,
  // Connection pool settings optimized for DigitalOcean
  max: process.env.NODE_ENV === 'production' ? 15 : 5,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  acquireTimeoutMillis: 60000,
  // Query timeout for long-running queries
  query_timeout: 60000,
  // Statement timeout
  statement_timeout: 30000,
  // Application name for monitoring
  application_name: 'essen-facebook-bot'
});

// Add error handler for pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

async function initDatabase() {
  try {
    // Test connection first
    const testResult = await pool.query('SELECT NOW() as now');
    console.log('Connected to PostgreSQL database at:', testResult.rows[0].now);
    
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
    console.log('Users table ready');

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
    console.log('Conversations table ready');

    // User preferences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        preferences JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('User preferences table ready');

    // Analytics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        event_type TEXT,
        user_id TEXT,
        data JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Analytics table ready');

    // Appointments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        facebook_name TEXT,
        appointment_date TEXT,
        appointment_time TEXT,
        phone_number TEXT,
        email TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Appointments table ready');

    // Admin users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    console.log('Admin users table ready');

    // Audit logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES admin_users(id),
        action TEXT NOT NULL,
        resource TEXT,
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Audit logs table ready');

    // Create default admin user if none exists
    const adminCheck = await pool.query('SELECT COUNT(*) as count FROM admin_users');
    if (adminCheck.rows[0].count === 0) {
      console.log('No admin users found, creating default admin...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('hello123', 10);
      
      const adminResult = await pool.query(
        'INSERT INTO admin_users (username, password) VALUES ($1, $2) RETURNING id',
        ['admin', hashedPassword]
      );
      console.log('✅ Default admin user created (username: admin, password: hello123)');
      console.log(`   Admin user ID: ${adminResult.rows[0].id}`);
    } else {
      console.log(`Found ${adminCheck.rows[0].count} admin user(s)`);
    }

    // Create indexes for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)');

    console.log('Database initialization complete');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Helper functions
const db = {
  // User operations
  saveUser: async (userId, userData) => {
    try {
      console.log('Saving user:', { userId, userData });
      const query = `
        INSERT INTO users (id, name, profile_pic, last_interaction)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          profile_pic = EXCLUDED.profile_pic,
          last_interaction = CURRENT_TIMESTAMP
      `;
      const result = await pool.query(query, [userId, userData.name, userData.profile_pic]);
      console.log('User saved successfully:', result.rowCount, 'rows affected');
      
      // Emit Socket.io event to admin interface
      adminEvents.newUser({
        id: userId,
        name: userData.name,
        profile_pic: userData.profile_pic,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error saving user:', err);
      console.error('Query params:', [userId, userData.name, userData.profile_pic]);
    }
  },

  getUser: async (userId) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      return result.rows[0];
    } catch (err) {
      console.error('Error getting user:', err);
      return null;
    }
  },

  // Conversation operations
  saveConversation: async (userId, message, response) => {
    try {
      console.log('Saving conversation:', { userId, message: message?.substring(0, 50), response: response?.substring(0, 50) });
      const query = `
        INSERT INTO conversations (user_id, message, response, timestamp)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING id, timestamp
      `;
      const result = await pool.query(query, [userId, message, response]);
      console.log('Conversation saved successfully:', result.rowCount, 'rows affected');
      
      // Get user info for the Socket.io event
      const user = await db.getUser(userId);
      
      // Emit Socket.io event to admin interface
      adminEvents.newConversation({
        id: result.rows?.[0]?.id || Date.now(),
        user_id: userId,
        user_name: user?.name || 'Unknown User',
        profile_pic: user?.profile_pic,
        message: message,
        response: response,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error saving conversation:', err);
      console.error('Query params:', [userId, message, response]);
    }
  },

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

  clearConversationHistory: async (userId) => {
    try {
      await pool.query('DELETE FROM conversations WHERE user_id = $1', [userId]);
    } catch (err) {
      console.error('Error clearing conversation history:', err);
    }
  },

  // Analytics operations
  trackEvent: async (eventType, userId, data = {}) => {
    try {
      const query = `
        INSERT INTO analytics (event_type, user_id, data, timestamp)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `;
      await pool.query(query, [eventType, userId, JSON.stringify(data)]);
    } catch (err) {
      console.error('Error tracking event:', err);
    }
  },

  // Alias for compatibility with SQLite version
  logAnalytics: async (eventType, userId, data = {}) => {
    return db.trackEvent(eventType, userId, data);
  },

  // Appointment operations
  saveAppointment: async (userId, facebookName, appointmentDate, appointmentTime, phoneNumber = null) => {
    try {
      const query = `
        INSERT INTO appointments (user_id, facebook_name, appointment_date, appointment_time, phone_number)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      const result = await pool.query(query, [
        userId,
        facebookName,
        appointmentDate,
        appointmentTime,
        phoneNumber
      ]);
      return result.rows[0].id;
    } catch (err) {
      console.error('Error saving appointment:', err);
      throw err;
    }
  },

  getUserAppointments: async (userId) => {
    try {
      const result = await pool.query(
        'SELECT * FROM appointments WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return result.rows;
    } catch (err) {
      console.error('Error getting user appointments:', err);
      return [];
    }
  },

  // User preferences
  saveUserPreferences: async (userId, preferences) => {
    try {
      const query = `
        INSERT INTO user_preferences (user_id, preferences, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          preferences = EXCLUDED.preferences,
          updated_at = CURRENT_TIMESTAMP
      `;
      await pool.query(query, [userId, JSON.stringify(preferences)]);
    } catch (err) {
      console.error('Error saving user preferences:', err);
    }
  },

  getUserPreferences: async (userId) => {
    try {
      const result = await pool.query(
        'SELECT preferences FROM user_preferences WHERE user_id = $1',
        [userId]
      );
      return result.rows[0]?.preferences || {};
    } catch (err) {
      console.error('Error getting user preferences:', err);
      return {};
    }
  },

  // Raw query for complex operations
  query: (text, params) => pool.query(text, params),
  
  // Get pool for transaction support
  getPool: () => pool
};

module.exports = { initDatabase, db };