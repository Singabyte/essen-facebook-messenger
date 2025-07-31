const { Pool } = require('pg');
const fs = require('fs');

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
    console.log('Connected to PostgreSQL database');
  }
});

async function initDatabase() {
  try {
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
        appointment_date TEXT,
        appointment_time TEXT,
        name TEXT,
        phone TEXT,
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
      const query = `
        INSERT INTO users (id, name, profile_pic, last_interaction)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          profile_pic = EXCLUDED.profile_pic,
          last_interaction = CURRENT_TIMESTAMP
      `;
      await pool.query(query, [userId, userData.name, userData.profile_pic]);
    } catch (err) {
      console.error('Error saving user:', err);
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
      const query = `
        INSERT INTO conversations (user_id, message, response, timestamp)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `;
      await pool.query(query, [userId, message, response]);
    } catch (err) {
      console.error('Error saving conversation:', err);
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

  // Appointment operations
  saveAppointment: async (appointmentData) => {
    try {
      const query = `
        INSERT INTO appointments (user_id, appointment_date, appointment_time, name, phone, email, message)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      const result = await pool.query(query, [
        appointmentData.user_id,
        appointmentData.appointment_date,
        appointmentData.appointment_time,
        appointmentData.name,
        appointmentData.phone,
        appointmentData.email,
        appointmentData.message
      ]);
      return result.rows[0].id;
    } catch (err) {
      console.error('Error saving appointment:', err);
      throw err;
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