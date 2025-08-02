const { pool } = require('./connection-pg');

const queries = {
  // User queries
  users: {
    getAll: async (filters = {}) => {
      const { limit = 20, offset = 0, search } = filters;
      
      let query = `
        SELECT 
          u.*,
          COUNT(DISTINCT c.id) as conversation_count,
          MAX(c.timestamp) as last_interaction
        FROM users u
        LEFT JOIN conversations c ON u.id = c.user_id
      `;
      
      const params = [];
      let paramCount = 0;
      
      if (search) {
        params.push(`%${search}%`);
        query += ` WHERE u.name ILIKE $${++paramCount}`;
      }
      
      query += ` GROUP BY u.id ORDER BY last_interaction DESC NULLS LAST`;
      
      // Get total count
      const countQuery = search 
        ? `SELECT COUNT(*) as total FROM users WHERE name ILIKE $1`
        : `SELECT COUNT(*) as total FROM users`;
      const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);
      
      // Get paginated results
      query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(parseInt(limit), parseInt(offset));
      
      const result = await pool.query(query, params);
      
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
    getOverview: async () => {
      const [totalResult, todayResult, activeResult] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM conversations'),
        pool.query('SELECT COUNT(*) as count FROM conversations WHERE DATE(timestamp) = CURRENT_DATE'),
        pool.query('SELECT COUNT(DISTINCT user_id) as count FROM conversations WHERE timestamp >= CURRENT_DATE - INTERVAL \'7 days\'')
      ]);
      
      return {
        totalConversations: parseInt(totalResult.rows[0]?.count || 0),
        todayConversations: parseInt(todayResult.rows[0]?.count || 0),
        activeUsers: parseInt(activeResult.rows[0]?.count || 0)
      };
    }
  }
};

module.exports = queries;