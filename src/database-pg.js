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

    // Performance monitoring tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        metric_name TEXT NOT NULL,
        metric_value DECIMAL,
        metric_type TEXT DEFAULT 'gauge',
        tags JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Performance metrics table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS query_performance (
        id SERIAL PRIMARY KEY,
        query_hash TEXT NOT NULL,
        query_text TEXT,
        execution_time_ms DECIMAL NOT NULL,
        rows_affected INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        endpoint TEXT
      )
    `);
    console.log('Query performance table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_analytics (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        conversation_length INTEGER DEFAULT 1,
        session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_end TIMESTAMP,
        messages_count INTEGER DEFAULT 1,
        commands_used TEXT[],
        appointment_booked BOOLEAN DEFAULT FALSE,
        products_inquired TEXT[],
        satisfaction_score INTEGER,
        conversion_type TEXT,
        response_time_avg_ms DECIMAL
      )
    `);
    console.log('Conversation analytics table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS business_metrics (
        id SERIAL PRIMARY KEY,
        metric_date DATE DEFAULT CURRENT_DATE,
        total_conversations INTEGER DEFAULT 0,
        unique_users INTEGER DEFAULT 0,
        appointments_booked INTEGER DEFAULT 0,
        conversion_rate DECIMAL DEFAULT 0,
        avg_session_length DECIMAL DEFAULT 0,
        popular_products JSONB,
        peak_hours JSONB,
        user_satisfaction DECIMAL DEFAULT 0
      )
    `);
    console.log('Business metrics table ready');

    // Create comprehensive indexes for performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_timestamp_desc ON conversations(timestamp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_analytics_user_event ON analytics(user_id, event_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_templates_category ON promotion_templates(category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_templates_active ON promotion_templates(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_faqs_active ON faqs(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage(template_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_template_usage_used_at ON template_usage(used_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_faq_usage_faq_id ON faq_usage(faq_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_faq_usage_asked_at ON faq_usage(asked_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(key_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_query_performance_timestamp ON query_performance(timestamp)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_query_performance_hash ON query_performance(query_hash)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversation_analytics_user ON conversation_analytics(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_conversation_analytics_session_start ON conversation_analytics(session_start)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_business_metrics_date ON business_metrics(metric_date)');

    // Create performance monitoring views
    await pool.query(`
      CREATE OR REPLACE VIEW v_database_performance AS
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation,
        most_common_vals,
        most_common_freqs
      FROM pg_stats 
      WHERE schemaname = 'public'
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW v_slow_queries AS
      SELECT 
        query_hash,
        query_text,
        AVG(execution_time_ms) as avg_execution_time,
        MAX(execution_time_ms) as max_execution_time,
        COUNT(*) as execution_count,
        MAX(timestamp) as last_execution
      FROM query_performance 
      WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY query_hash, query_text
      HAVING AVG(execution_time_ms) > 100
      ORDER BY avg_execution_time DESC
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW v_user_engagement AS
      SELECT 
        u.id,
        u.name,
        u.created_at,
        u.last_interaction,
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(DISTINCT a.id) as total_appointments,
        EXTRACT(EPOCH FROM (MAX(c.timestamp) - MIN(c.timestamp)))/3600 as engagement_hours,
        array_agg(DISTINCT CASE WHEN c.message LIKE '/%' THEN SPLIT_PART(c.message, ' ', 1) END) FILTER (WHERE c.message LIKE '/%') as commands_used
      FROM users u
      LEFT JOIN conversations c ON u.id = c.user_id
      LEFT JOIN appointments a ON u.id = a.user_id
      WHERE u.last_interaction >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY u.id, u.name, u.created_at, u.last_interaction
      ORDER BY total_conversations DESC
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW v_conversion_funnel AS
      WITH funnel_stages AS (
        SELECT 
          user_id,
          MIN(timestamp) as first_interaction,
          COUNT(*) as total_messages,
          BOOL_OR(message ILIKE '%product%' OR message ILIKE '%showroom%') as showed_interest,
          BOOL_OR(message ILIKE '%consultation%' OR message ILIKE '%appointment%') as requested_consultation,
          EXISTS(SELECT 1 FROM appointments a WHERE a.user_id = c.user_id) as booked_appointment
        FROM conversations c
        WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY user_id
      )
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE showed_interest) as interested_users,
        COUNT(*) FILTER (WHERE requested_consultation) as consultation_requests,
        COUNT(*) FILTER (WHERE booked_appointment) as appointments_booked,
        ROUND(COUNT(*) FILTER (WHERE showed_interest) * 100.0 / COUNT(*), 2) as interest_rate,
        ROUND(COUNT(*) FILTER (WHERE requested_consultation) * 100.0 / COUNT(*) FILTER (WHERE showed_interest), 2) as consultation_rate,
        ROUND(COUNT(*) FILTER (WHERE booked_appointment) * 100.0 / COUNT(*) FILTER (WHERE requested_consultation), 2) as booking_rate
      FROM funnel_stages
    `);

    // Schedule daily business metrics updates
    scheduleBusinessMetricsUpdates();
    
    console.log('Database initialization complete');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Schedule daily business metrics updates
function scheduleBusinessMetricsUpdates() {
  // Update metrics every hour
  setInterval(async () => {
    try {
      await db.updateDailyBusinessMetrics();
      
      // Send real-time update to analytics dashboard
      const { adminEvents } = require('./admin-socket-client');
      const latestMetrics = await db.getBusinessMetrics(new Date().toISOString().split('T')[0]);
      
      if (latestMetrics.length > 0) {
        adminEvents.businessMetricUpdate(latestMetrics[0]);
      }
    } catch (error) {
      console.error('Error in scheduled business metrics update:', error);
    }
  }, 3600000); // Every hour
  
  // Also update immediately
  setTimeout(async () => {
    try {
      await db.updateDailyBusinessMetrics();
      console.log('Initial business metrics update completed');
    } catch (error) {
      console.error('Error in initial business metrics update:', error);
    }
  }, 10000); // After 10 seconds
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

  // Enhanced query function with performance tracking
  query: async (text, params) => {
    const startTime = Date.now();
    try {
      const result = await pool.query(text, params);
      const executionTime = Date.now() - startTime;
      
      // Track query performance
      await db.trackQueryPerformance(text, executionTime, result.rowCount);
      
      // Send real-time update if query is slow
      if (executionTime > 1000) { // Over 1 second
        const { adminEvents } = require('./admin-socket-client');
        adminEvents.slowQueryDetected({
          query_text: text.substring(0, 100) + '...',
          execution_time: executionTime,
          timestamp: new Date().toISOString()
        });
      }
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      await db.trackQueryPerformance(text, executionTime, 0);
      throw error;
    }
  },

  // Raw query for complex operations (without tracking)
  rawQuery: (text, params) => pool.query(text, params),
  
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
  },

  // Performance monitoring functions
  trackQueryPerformance: async (queryText, executionTime, rowsAffected = null, userId = null, endpoint = null) => {
    try {
      const crypto = require('crypto');
      const queryHash = crypto.createHash('md5').update(queryText).digest('hex');
      
      await pool.query(`
        INSERT INTO query_performance (query_hash, query_text, execution_time_ms, rows_affected, user_id, endpoint)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [queryHash, queryText, executionTime, rowsAffected, userId, endpoint]);
    } catch (err) {
      console.error('Error tracking query performance:', err);
    }
  },

  recordMetric: async (metricName, value, type = 'gauge', tags = {}) => {
    try {
      await pool.query(`
        INSERT INTO performance_metrics (metric_name, metric_value, metric_type, tags)
        VALUES ($1, $2, $3, $4)
      `, [metricName, value, type, JSON.stringify(tags)]);
    } catch (err) {
      console.error('Error recording metric:', err);
    }
  },

  // Business analytics functions
  getBusinessMetrics: async (startDate = null, endDate = null) => {
    try {
      let dateFilter = '';
      const params = [];
      
      if (startDate && endDate) {
        dateFilter = 'WHERE metric_date BETWEEN $1 AND $2';
        params.push(startDate, endDate);
      } else if (startDate) {
        dateFilter = 'WHERE metric_date >= $1';
        params.push(startDate);
      } else if (endDate) {
        dateFilter = 'WHERE metric_date <= $1';
        params.push(endDate);
      }
      
      const result = await pool.query(`
        SELECT * FROM business_metrics ${dateFilter} ORDER BY metric_date DESC
      `, params);
      
      return result.rows;
    } catch (err) {
      console.error('Error getting business metrics:', err);
      return [];
    }
  },

  getUserEngagementMetrics: async (limit = 50) => {
    try {
      const result = await pool.query('SELECT * FROM v_user_engagement LIMIT $1', [limit]);
      return result.rows;
    } catch (err) {
      console.error('Error getting user engagement metrics:', err);
      return [];
    }
  },

  getConversionFunnel: async () => {
    try {
      const result = await pool.query('SELECT * FROM v_conversion_funnel');
      return result.rows[0] || {};
    } catch (err) {
      console.error('Error getting conversion funnel:', err);
      return {};
    }
  },

  getSlowQueries: async (limit = 20) => {
    try {
      const result = await pool.query('SELECT * FROM v_slow_queries LIMIT $1', [limit]);
      return result.rows;
    } catch (err) {
      console.error('Error getting slow queries:', err);
      return [];
    }
  },

  getProductInquiryTrends: async (days = 30) => {
    try {
      const result = await pool.query(`
        WITH product_mentions AS (
          SELECT 
            DATE_TRUNC('day', timestamp) as date,
            CASE 
              WHEN message ILIKE '%kitchen%' OR response ILIKE '%kitchen%' THEN 'Kitchen'
              WHEN message ILIKE '%wardrobe%' OR response ILIKE '%wardrobe%' THEN 'Wardrobe'
              WHEN message ILIKE '%living%' OR response ILIKE '%living%' THEN 'Living Room'
              WHEN message ILIKE '%bedroom%' OR response ILIKE '%bedroom%' THEN 'Bedroom'
              WHEN message ILIKE '%bathroom%' OR response ILIKE '%bathroom%' THEN 'Bathroom'
              WHEN message ILIKE '%cabinet%' OR response ILIKE '%cabinet%' THEN 'Cabinet'
              WHEN message ILIKE '%renovation%' OR response ILIKE '%renovation%' THEN 'Full Renovation'
              ELSE 'General Inquiry'
            END as product_category,
            COUNT(*) as mentions
          FROM conversations 
          WHERE timestamp >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY DATE_TRUNC('day', timestamp), product_category
        )
        SELECT 
          product_category,
          SUM(mentions) as total_mentions,
          COUNT(DISTINCT date) as days_mentioned,
          AVG(mentions) as avg_daily_mentions
        FROM product_mentions
        WHERE product_category != 'General Inquiry'
        GROUP BY product_category
        ORDER BY total_mentions DESC
      `);
      
      return result.rows;
    } catch (err) {
      console.error('Error getting product inquiry trends:', err);
      return [];
    }
  },

  getAppointmentAnalytics: async (days = 30) => {
    try {
      const result = await pool.query(`
        WITH appointment_stats AS (
          SELECT 
            DATE_TRUNC('day', created_at) as date,
            COUNT(*) as appointments,
            array_agg(appointment_time) as times
          FROM appointments
          WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY DATE_TRUNC('day', created_at)
        ),
        hourly_preferences AS (
          SELECT 
            EXTRACT(HOUR FROM created_at::timestamp) as hour,
            COUNT(*) as bookings
          FROM appointments
          WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY EXTRACT(HOUR FROM created_at::timestamp)
          ORDER BY bookings DESC
        )
        SELECT 
          json_build_object(
            'daily_stats', (SELECT json_agg(row_to_json(appointment_stats)) FROM appointment_stats),
            'peak_hours', (SELECT json_agg(row_to_json(hourly_preferences)) FROM hourly_preferences),
            'total_appointments', (SELECT COUNT(*) FROM appointments WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'),
            'conversion_rate', (
              SELECT ROUND(
                COUNT(DISTINCT a.user_id) * 100.0 / NULLIF(COUNT(DISTINCT c.user_id), 0), 2
              )
              FROM conversations c
              LEFT JOIN appointments a ON c.user_id = a.user_id
              WHERE c.timestamp >= CURRENT_DATE - INTERVAL '${days} days'
            )
          ) as analytics
      `);
      
      return result.rows[0]?.analytics || {};
    } catch (err) {
      console.error('Error getting appointment analytics:', err);
      return {};
    }
  },

  updateDailyBusinessMetrics: async (date = null) => {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const metricsResult = await pool.query(`
        WITH daily_stats AS (
          SELECT 
            COUNT(DISTINCT c.id) as total_conversations,
            COUNT(DISTINCT c.user_id) as unique_users,
            COUNT(DISTINCT a.id) as appointments_booked,
            AVG(EXTRACT(EPOCH FROM (c2.timestamp - c1.timestamp))/60) as avg_session_length
          FROM conversations c
          LEFT JOIN appointments a ON c.user_id = a.user_id AND DATE(a.created_at) = $1
          LEFT JOIN conversations c1 ON c.user_id = c1.user_id 
          LEFT JOIN conversations c2 ON c.user_id = c2.user_id
          WHERE DATE(c.timestamp) = $1
          AND c1.id = (SELECT MIN(id) FROM conversations WHERE user_id = c.user_id AND DATE(timestamp) = $1)
          AND c2.id = (SELECT MAX(id) FROM conversations WHERE user_id = c.user_id AND DATE(timestamp) = $1)
        ),
        popular_products AS (
          SELECT json_agg(json_build_object('category', product_category, 'mentions', total_mentions)) as products
          FROM (
            SELECT 
              CASE 
                WHEN message ILIKE '%kitchen%' OR response ILIKE '%kitchen%' THEN 'Kitchen'
                WHEN message ILIKE '%wardrobe%' OR response ILIKE '%wardrobe%' THEN 'Wardrobe'
                WHEN message ILIKE '%living%' OR response ILIKE '%living%' THEN 'Living Room'
                WHEN message ILIKE '%bedroom%' OR response ILIKE '%bedroom%' THEN 'Bedroom'
                ELSE 'General'
              END as product_category,
              COUNT(*) as total_mentions
            FROM conversations 
            WHERE DATE(timestamp) = $1
            GROUP BY product_category
            ORDER BY total_mentions DESC
            LIMIT 5
          ) p
        ),
        peak_hours AS (
          SELECT json_agg(json_build_object('hour', hour, 'messages', messages)) as hours
          FROM (
            SELECT 
              EXTRACT(HOUR FROM timestamp) as hour,
              COUNT(*) as messages
            FROM conversations 
            WHERE DATE(timestamp) = $1
            GROUP BY EXTRACT(HOUR FROM timestamp)
            ORDER BY messages DESC
            LIMIT 3
          ) h
        )
        INSERT INTO business_metrics (
          metric_date, total_conversations, unique_users, appointments_booked, 
          conversion_rate, avg_session_length, popular_products, peak_hours
        )
        SELECT 
          $1::date,
          ds.total_conversations,
          ds.unique_users,
          ds.appointments_booked,
          CASE WHEN ds.unique_users > 0 THEN ROUND(ds.appointments_booked * 100.0 / ds.unique_users, 2) ELSE 0 END,
          COALESCE(ds.avg_session_length, 0),
          pp.products,
          ph.hours
        FROM daily_stats ds, popular_products pp, peak_hours ph
        ON CONFLICT (metric_date) DO UPDATE SET
          total_conversations = EXCLUDED.total_conversations,
          unique_users = EXCLUDED.unique_users,
          appointments_booked = EXCLUDED.appointments_booked,
          conversion_rate = EXCLUDED.conversion_rate,
          avg_session_length = EXCLUDED.avg_session_length,
          popular_products = EXCLUDED.popular_products,
          peak_hours = EXCLUDED.peak_hours
      `, [targetDate]);
      
      console.log(`Business metrics updated for ${targetDate}`);
    } catch (err) {
      console.error('Error updating daily business metrics:', err);
    }
  },

  // Data retention and archival
  archiveOldConversations: async (daysToKeep = 180) => {
    try {
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - daysToKeep);
      
      // Create archive table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS conversations_archive (
          LIKE conversations INCLUDING ALL
        )
      `);
      
      // Move old conversations to archive
      const archiveResult = await pool.query(`
        INSERT INTO conversations_archive 
        SELECT * FROM conversations 
        WHERE timestamp < $1
      `, [archiveDate]);
      
      // Delete archived conversations from main table
      const deleteResult = await pool.query(`
        DELETE FROM conversations WHERE timestamp < $1
      `, [archiveDate]);
      
      console.log(`Archived ${archiveResult.rowCount} conversations older than ${daysToKeep} days`);
      return archiveResult.rowCount;
    } catch (err) {
      console.error('Error archiving conversations:', err);
      return 0;
    }
  },

  // Database maintenance
  optimizeDatabase: async () => {
    try {
      // Update table statistics
      await pool.query('ANALYZE');
      
      // Reindex if needed
      await pool.query('REINDEX DATABASE CONCURRENTLY');
      
      console.log('Database optimization completed');
    } catch (err) {
      console.error('Error optimizing database:', err);
    }
  },

  // Connection pool monitoring
  getConnectionPoolStats: () => {
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  }
};

module.exports = { initDatabase, db };