const { pool } = require('./connection-pg');

const queries = {
  // User queries
  users: {
    getAll: async (filters = {}) => {
      const { limit = 20, offset = 0, search } = filters;
      
      console.log('Users.getAll called with:', { limit, offset, search });
      
      let query = `
        SELECT 
          u.id,
          u.name,
          u.profile_pic,
          u.created_at,
          u.last_interaction,
          COUNT(DISTINCT c.id) as conversation_count
        FROM users u
        LEFT JOIN conversations c ON u.id = c.user_id
      `;
      
      const params = [];
      let paramCount = 0;
      
      if (search) {
        params.push(`%${search}%`);
        query += ` WHERE u.name ILIKE $${++paramCount}`;
      }
      
      query += ` GROUP BY u.id, u.name, u.profile_pic, u.created_at, u.last_interaction ORDER BY u.last_interaction DESC NULLS LAST`;
      
      // Get total count
      const countQuery = search 
        ? `SELECT COUNT(*) as total FROM users WHERE name ILIKE $1`
        : `SELECT COUNT(*) as total FROM users`;
      const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);
      
      console.log('Total users found:', countResult.rows[0]?.total || 0);
      
      // Get paginated results
      query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(parseInt(limit), parseInt(offset));
      
      const result = await pool.query(query, params);
      
      console.log('Users returned:', result.rows.length);
      
      return {
        users: result.rows,
        total: parseInt(countResult.rows[0]?.total || 0)
      };
    },
    
    getById: async (id) => {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    }
  },
  
  // Conversation queries
  conversations: {
    getAll: async (filters = {}) => {
      const { userId, limit = 20, offset = 0, startDate, endDate } = filters;
      
      let query = `
        SELECT 
          c.*,
          u.name as user_name,
          u.profile_pic
        FROM conversations c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE 1=1
      `;
      
      const params = [];
      let paramCount = 0;
      
      if (userId) {
        params.push(userId);
        query += ` AND c.user_id = $${++paramCount}`;
      }
      
      if (startDate) {
        params.push(startDate);
        query += ` AND c.timestamp >= $${++paramCount}`;
      }
      
      if (endDate) {
        params.push(endDate);
        query += ` AND c.timestamp <= $${++paramCount}`;
      }
      
      // Get total count
      const countParams = [...params];
      const countQuery = query.replace(
        'SELECT c.*, u.name as user_name, u.profile_pic FROM conversations c LEFT JOIN users u ON c.user_id = u.id',
        'SELECT COUNT(*) as total FROM conversations c'
      );
      const countResult = await pool.query(countQuery, countParams);
      
      // Get paginated results
      query += ` ORDER BY c.timestamp DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(parseInt(limit), parseInt(offset));
      
      const result = await pool.query(query, params);
      
      return {
        conversations: result.rows,
        total: parseInt(countResult.rows[0]?.total || 0)
      };
    },
    
    search: async (searchTerm, limit = 20, offset = 0) => {
      const query = `
        SELECT 
          c.*,
          u.name as user_name,
          u.profile_pic
        FROM conversations c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.message ILIKE $1 OR c.response ILIKE $1
        ORDER BY c.timestamp DESC
        LIMIT $2 OFFSET $3
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM conversations c
        WHERE c.message ILIKE $1 OR c.response ILIKE $1
      `;
      
      const searchParam = `%${searchTerm}%`;
      
      const [result, countResult] = await Promise.all([
        pool.query(query, [searchParam, parseInt(limit), parseInt(offset)]),
        pool.query(countQuery, [searchParam])
      ]);
      
      return {
        conversations: result.rows,
        total: parseInt(countResult.rows[0]?.total || 0)
      };
    }
  },
  
  // Analytics queries
  analytics: {
    getOverview: async (startDate = null, endDate = null) => {
      let dateFilter = '';
      const params = [];
      let paramCount = 0;
      
      if (startDate && endDate) {
        dateFilter = 'AND timestamp BETWEEN $1 AND $2';
        params.push(startDate, endDate);
        paramCount = 2;
      } else if (startDate) {
        dateFilter = 'AND timestamp >= $1';
        params.push(startDate);
        paramCount = 1;
      } else if (endDate) {
        dateFilter = 'AND timestamp <= $1';
        params.push(endDate);
        paramCount = 1;
      }
      
      const [
        totalUsersResult,
        activeUsersResult,
        totalConversationsResult,
        totalAppointmentsResult,
        avgResponseTimeResult
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM users'),
        pool.query(`
          SELECT COUNT(DISTINCT user_id) as count 
          FROM conversations 
          WHERE 1=1 ${dateFilter || 'AND timestamp >= CURRENT_DATE - INTERVAL \'30 days\''}
        `, dateFilter ? params : []),
        pool.query(`SELECT COUNT(*) as count FROM conversations WHERE 1=1 ${dateFilter}`, params),
        pool.query(`SELECT COUNT(*) as count FROM appointments WHERE 1=1 ${dateFilter.replace('timestamp', 'created_at')}`, params),
        pool.query(`
          SELECT AVG(execution_time_ms) as avg_time 
          FROM query_performance 
          WHERE 1=1 ${dateFilter}
        `, params)
      ]);
      
      return {
        totalUsers: parseInt(totalUsersResult.rows[0]?.count || 0),
        activeUsers: parseInt(activeUsersResult.rows[0]?.count || 0),
        totalConversations: parseInt(totalConversationsResult.rows[0]?.count || 0),
        totalAppointments: parseInt(totalAppointmentsResult.rows[0]?.count || 0),
        averageResponseTime: parseFloat(avgResponseTimeResult.rows[0]?.avg_time || 0),
        period: { startDate, endDate }
      };
    },

    getBusinessMetrics: async (days = 30) => {
      const result = await pool.query(`
        SELECT * FROM business_metrics 
        WHERE metric_date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY metric_date DESC
      `);
      return result.rows;
    },

    getUserEngagement: async (limit = 50) => {
      try {
        const result = await pool.query('SELECT * FROM analytics.v_user_engagement_summary LIMIT $1', [limit]);
        return result.rows;
      } catch (error) {
        console.error('User engagement view not found, using fallback query');
        // Fallback to basic query if view doesn't exist
        const result = await pool.query(`
          SELECT 
            'All Users' as customer_segment,
            COUNT(*) as user_count,
            0 as avg_conversations,
            0 as avg_messages,
            0 as avg_appointments,
            0 as avg_engagement_score
          FROM users
        `);
        return result.rows;
      }
    },

    getConversionFunnel: async () => {
      try {
        const result = await pool.query('SELECT * FROM analytics.v_conversion_funnel');
        return result.rows[0] || {};
      } catch (error) {
        console.error('Conversion funnel view not found, returning default data');
        // Return default structure if view doesn't exist
        return {
          total_users: 0,
          engaged_users: 0,
          product_inquiry_users: 0,
          appointment_users: 0,
          confirmed_appointment_users: 0,
          engagement_rate: 0,
          inquiry_rate: 0,
          appointment_rate: 0,
          confirmation_rate: 0
        };
      }
    },

    getProductTrends: async (days = 30) => {
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
          AVG(mentions) as avg_daily_mentions,
          array_agg(json_build_object('date', date, 'mentions', mentions) ORDER BY date) as daily_data
        FROM product_mentions
        WHERE product_category != 'General Inquiry'
        GROUP BY product_category
        ORDER BY total_mentions DESC
      `);
      return result.rows;
    },

    getAppointmentAnalytics: async (days = 30) => {
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
        ),
        conversion_stats AS (
          SELECT 
            COUNT(DISTINCT c.user_id) as total_users,
            COUNT(DISTINCT a.user_id) as converted_users,
            ROUND(COUNT(DISTINCT a.user_id) * 100.0 / NULLIF(COUNT(DISTINCT c.user_id), 0), 2) as conversion_rate
          FROM conversations c
          LEFT JOIN appointments a ON c.user_id = a.user_id
          WHERE c.timestamp >= CURRENT_DATE - INTERVAL '${days} days'
        )
        SELECT 
          json_build_object(
            'daily_stats', (SELECT json_agg(row_to_json(appointment_stats)) FROM appointment_stats),
            'peak_hours', (SELECT json_agg(row_to_json(hourly_preferences)) FROM hourly_preferences),
            'total_appointments', (SELECT COUNT(*) FROM appointments WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'),
            'conversion_stats', (SELECT row_to_json(conversion_stats) FROM conversion_stats)
          ) as analytics
      `);
      
      return result.rows[0]?.analytics || {};
    },

    getPeakUsageHours: async (days = 30) => {
      const result = await pool.query(`
        SELECT 
          EXTRACT(HOUR FROM timestamp) as hour,
          COUNT(*) as message_count,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(CASE WHEN message LIKE '/%' THEN 1 ELSE 0 END) as command_ratio
        FROM conversations
        WHERE timestamp >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY message_count DESC
      `);
      return result.rows;
    },

    getUserSatisfactionMetrics: async (days = 30) => {
      const result = await pool.query(`
        WITH satisfaction_indicators AS (
          SELECT 
            user_id,
            COUNT(*) as total_messages,
            BOOL_OR(message ILIKE '%thank%' OR message ILIKE '%great%' OR message ILIKE '%helpful%') as positive_feedback,
            BOOL_OR(message ILIKE '%problem%' OR message ILIKE '%issue%' OR message ILIKE '%not work%') as negative_feedback,
            COUNT(*) FILTER (WHERE message LIKE '/%help%') as help_requests,
            EXISTS(SELECT 1 FROM appointments a WHERE a.user_id = c.user_id) as booked_appointment
          FROM conversations c
          WHERE timestamp >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY user_id
        )
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE positive_feedback) as positive_users,
          COUNT(*) FILTER (WHERE negative_feedback) as negative_users,
          COUNT(*) FILTER (WHERE booked_appointment) as converted_users,
          AVG(total_messages) as avg_messages_per_user,
          AVG(help_requests) as avg_help_requests,
          ROUND(COUNT(*) FILTER (WHERE positive_feedback) * 100.0 / COUNT(*), 2) as satisfaction_rate
        FROM satisfaction_indicators
      `);
      return result.rows[0] || {};
    },

    getPerformanceMetrics: async (days = 7) => {
      const result = await pool.query(`
        SELECT 
          metric_name,
          AVG(metric_value) as avg_value,
          MAX(metric_value) as max_value,
          MIN(metric_value) as min_value,
          COUNT(*) as data_points
        FROM performance_metrics
        WHERE timestamp >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY metric_name
        ORDER BY metric_name
      `);
      return result.rows;
    },

    getSlowQueries: async (limit = 20) => {
      try {
        const result = await pool.query('SELECT * FROM analytics.v_slow_queries LIMIT $1', [limit]);
        return result.rows;
      } catch (error) {
        console.error('Slow queries view not found, returning empty array');
        return [];
      }
    },

    getDatabaseStats: async () => {
      try {
        // Try to get basic connection stats first
        const connectionStatsResult = await pool.query(`
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections,
            count(*) FILTER (WHERE state = 'idle') as idle_connections
          FROM pg_stat_activity
          WHERE datname = current_database()
        `);

        // For table and index stats, use simpler queries that work on managed databases
        let tableStats = [];
        let indexStats = [];
        
        try {
          // Try to get table stats with a more compatible query
          const tableStatsResult = await pool.query(`
            SELECT 
              t.schemaname,
              t.tablename,
              pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) as size
            FROM pg_tables t
            WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY pg_total_relation_size(t.schemaname||'.'||t.tablename) DESC
            LIMIT 10
          `);
          tableStats = tableStatsResult.rows;
        } catch (error) {
          console.error('Could not fetch table stats:', error.message);
        }

        return {
          tables: tableStats,
          indexes: indexStats,
          connections: connectionStatsResult.rows[0] || {}
        };
      } catch (error) {
        console.error('Error fetching database stats:', error.message);
        // Return empty structure on error
        return {
          tables: [],
          indexes: [],
          connections: {
            total_connections: 0,
            active_connections: 0,
            idle_connections: 0
          }
        };
      }
    }
  }
};

module.exports = queries;