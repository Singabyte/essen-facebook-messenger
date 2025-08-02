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

    // Promotion templates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS promotion_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        quick_replies TEXT,
        media_url TEXT,
        media_type TEXT,
        variables TEXT,
        trigger_keywords TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Promotion templates table ready');

    // Template usage table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS template_usage (
        id SERIAL PRIMARY KEY,
        template_id INTEGER REFERENCES promotion_templates(id),
        user_id TEXT REFERENCES users(id),
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        conversation_context TEXT
      )
    `);
    console.log('Template usage table ready');

    // FAQs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT,
        keywords TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('FAQs table ready');

    // FAQ usage table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faq_usage (
        id SERIAL PRIMARY KEY,
        faq_id INTEGER REFERENCES faqs(id),
        user_id TEXT REFERENCES users(id),
        question_asked TEXT,
        asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('FAQ usage table ready');

    // Bot configuration table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_config (
        id SERIAL PRIMARY KEY,
        key_name TEXT UNIQUE NOT NULL,
        value TEXT,
        data_type TEXT DEFAULT 'string',
        category TEXT DEFAULT 'general',
        description TEXT,
        default_value TEXT,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Bot configuration table ready');

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

    // Initialize default bot configuration
    await initializeDefaultBotConfig();

    async function initializeDefaultBotConfig() {
      const defaultConfigs = [
        {
          key_name: 'promotion_delay_ms',
          value: '5000',
          data_type: 'number',
          category: 'timing',
          description: 'Delay between promotion messages in milliseconds',
          default_value: '5000'
        },
        {
          key_name: 'follow_up_delay_ms',
          value: '300000',
          data_type: 'number',
          category: 'timing',
          description: 'Delay before sending follow-up messages in milliseconds',
          default_value: '300000'
        },
        {
          key_name: 'human_intervention_threshold',
          value: '3',
          data_type: 'number',
          category: 'ai',
          description: 'Number of unresolved messages before suggesting human intervention',
          default_value: '3'
        },
        {
          key_name: 'template_matching_enabled',
          value: '1',
          data_type: 'boolean',
          category: 'features',
          description: 'Enable automatic template matching for promotions',
          default_value: '1'
        },
        {
          key_name: 'faq_matching_enabled',
          value: '1',
          data_type: 'boolean',
          category: 'features',
          description: 'Enable automatic FAQ matching for common questions',
          default_value: '1'
        },
        {
          key_name: 'quick_replies_enabled',
          value: '1',
          data_type: 'boolean',
          category: 'features',
          description: 'Enable quick reply suggestions',
          default_value: '1'
        }
      ];

      for (const config of defaultConfigs) {
        try {
          await pool.query(`
            INSERT INTO bot_config (key_name, value, data_type, category, description, default_value)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (key_name) DO NOTHING
          `, [config.key_name, config.value, config.data_type, config.category, config.description, config.default_value]);
        } catch (err) {
          console.error(`Error initializing config ${config.key_name}:`, err);
        }
      }
      
      console.log('Default bot configuration initialized');
    }

    // Create indexes for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_templates_category ON promotion_templates(category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_templates_active ON promotion_templates(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_faqs_active ON faqs(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage(template_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_faq_usage_faq_id ON faq_usage(faq_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(key_name)');

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
      
      // Emit Socket.io event to admin interface
      adminEvents.newAppointment({
        id: result.rows[0].id,
        user_id: userId,
        facebook_name: facebookName,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        phone_number: phoneNumber,
        timestamp: new Date().toISOString()
      });
      
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
  getPool: () => pool,

  // Template operations
  getActiveTemplates: async (category = null) => {
    try {
      let query = 'SELECT * FROM promotion_templates WHERE is_active = true';
      const params = [];
      
      if (category) {
        query += ' AND category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY created_at DESC';
      const result = await pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('Error getting active templates:', err);
      return [];
    }
  },

  getTemplateById: async (templateId) => {
    try {
      const result = await pool.query(
        'SELECT * FROM promotion_templates WHERE id = $1 AND is_active = true',
        [templateId]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error getting template by ID:', err);
      return null;
    }
  },

  getTemplatesByKeywords: async (keywords) => {
    try {
      const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
      const query = `
        SELECT * FROM promotion_templates 
        WHERE is_active = true
        AND (
          ${keywordArray.map((_, index) => `trigger_keywords ILIKE $${index + 1}`).join(' OR ')}
        )
        ORDER BY created_at DESC
      `;
      const params = keywordArray.map(keyword => `%"${keyword}"%`);
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('Error getting templates by keywords:', err);
      return [];
    }
  },

  logTemplateUsage: async (templateId, userId, context = null) => {
    try {
      await pool.query(
        'INSERT INTO template_usage (template_id, user_id, conversation_context) VALUES ($1, $2, $3)',
        [templateId, userId, context]
      );
    } catch (err) {
      console.error('Error logging template usage:', err);
    }
  },

  // FAQ operations
  getActiveFAQs: async (category = null) => {
    try {
      let query = 'SELECT * FROM faqs WHERE is_active = true';
      const params = [];
      
      if (category) {
        query += ' AND category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY sort_order ASC, created_at DESC';
      const result = await pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('Error getting active FAQs:', err);
      return [];
    }
  },

  searchFAQs: async (searchQuery, limit = 10) => {
    try {
      const query = `
        SELECT *, 
          CASE 
            WHEN question ILIKE $1 THEN 3
            WHEN keywords ILIKE $1 THEN 2
            WHEN answer ILIKE $1 THEN 1
            ELSE 0
          END as relevance_score
        FROM faqs 
        WHERE is_active = true 
          AND (question ILIKE $1 OR answer ILIKE $1 OR keywords ILIKE $1)
        ORDER BY relevance_score DESC, sort_order ASC
        LIMIT $2
      `;
      
      const result = await pool.query(query, [`%${searchQuery}%`, limit]);
      return result.rows;
    } catch (err) {
      console.error('Error searching FAQs:', err);
      return [];
    }
  },

  getFAQById: async (faqId) => {
    try {
      const result = await pool.query(
        'SELECT * FROM faqs WHERE id = $1 AND is_active = true',
        [faqId]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error getting FAQ by ID:', err);
      return null;
    }
  },

  logFAQUsage: async (faqId, userId, questionAsked) => {
    try {
      await pool.query(
        'INSERT INTO faq_usage (faq_id, user_id, question_asked) VALUES ($1, $2, $3)',
        [faqId, userId, questionAsked]
      );
    } catch (err) {
      console.error('Error logging FAQ usage:', err);
    }
  },

  // Bot configuration operations
  getBotConfig: async (key = null) => {
    try {
      if (key) {
        const result = await pool.query(
          'SELECT * FROM bot_config WHERE key_name = $1',
          [key]
        );
        const config = result.rows[0];
        if (config && config.data_type === 'json') {
          config.value = JSON.parse(config.value || '{}');
        }
        return config;
      } else {
        const result = await pool.query('SELECT * FROM bot_config ORDER BY category, key_name');
        return result.rows.map(config => {
          if (config.data_type === 'json') {
            config.value = JSON.parse(config.value || '{}');
          }
          return config;
        });
      }
    } catch (err) {
      console.error('Error getting bot config:', err);
      return key ? null : [];
    }
  },

  setBotConfig: async (key, value, dataType = 'string') => {
    try {
      let processedValue = value;
      if (dataType === 'json') {
        processedValue = typeof value === 'string' ? value : JSON.stringify(value);
      } else if (dataType === 'boolean') {
        processedValue = value ? '1' : '0';
      } else if (dataType === 'number') {
        processedValue = value.toString();
      }
      
      await pool.query(`
        INSERT INTO bot_config (key_name, value, data_type) 
        VALUES ($1, $2, $3)
        ON CONFLICT (key_name) DO UPDATE SET 
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
      `, [key, processedValue, dataType]);
    } catch (err) {
      console.error('Error setting bot config:', err);
    }
  }
};

module.exports = { initDatabase, db };