const { get, all, run } = require('./connection');

const queries = {
  // User queries
  users: {
    getAll: async (limit = 20, offset = 0) => {
      const users = await all(
        `SELECT id, name, profile_pic, created_at, last_interaction 
         FROM users 
         ORDER BY last_interaction DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const total = await get('SELECT COUNT(*) as count FROM users');
      return { users, total: total.count };
    },
    
    getById: async (userId) => {
      return await get('SELECT * FROM users WHERE id = ?', [userId]);
    },
    
    search: async (query, limit = 20) => {
      return await all(
        `SELECT * FROM users 
         WHERE name LIKE ? 
         ORDER BY last_interaction DESC 
         LIMIT ?`,
        [`%${query}%`, limit]
      );
    }
  },
  
  // Conversation queries
  conversations: {
    getAll: async (filters = {}) => {
      let sql = `SELECT c.*, u.name as user_name 
                 FROM conversations c 
                 LEFT JOIN users u ON c.user_id = u.id`;
      const params = [];
      const conditions = [];
      
      if (filters.userId) {
        conditions.push('c.user_id = ?');
        params.push(filters.userId);
      }
      
      if (filters.startDate) {
        conditions.push('c.timestamp >= ?');
        params.push(filters.startDate);
      }
      
      if (filters.endDate) {
        conditions.push('c.timestamp <= ?');
        params.push(filters.endDate);
      }
      
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      sql += ' ORDER BY c.timestamp DESC LIMIT ? OFFSET ?';
      params.push(filters.limit || 20, filters.offset || 0);
      
      const conversations = await all(sql, params);
      
      // Get total count
      let countSql = 'SELECT COUNT(*) as count FROM conversations c';
      if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
      }
      const total = await get(countSql, params.slice(0, -2));
      
      return { conversations, total: total.count };
    },
    
    search: async (query, limit = 20) => {
      return await all(
        `SELECT c.*, u.name as user_name 
         FROM conversations c 
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.message LIKE ? OR c.response LIKE ?
         ORDER BY c.timestamp DESC 
         LIMIT ?`,
        [`%${query}%`, `%${query}%`, limit]
      );
    },
    
    getStats: async () => {
      const total = await get('SELECT COUNT(*) as count FROM conversations');
      const today = await get(
        `SELECT COUNT(*) as count FROM conversations 
         WHERE DATE(timestamp) = DATE('now')`
      );
      const commands = await all(
        `SELECT message, COUNT(*) as count 
         FROM conversations 
         WHERE message LIKE '/%'
         GROUP BY message 
         ORDER BY count DESC 
         LIMIT 10`
      );
      
      return {
        totalConversations: total.count,
        todayConversations: today.count,
        popularCommands: commands
      };
    }
  },
  
  // Appointment queries
  appointments: {
    getAll: async (limit = 20, offset = 0, filters = {}) => {
      let sql = `SELECT a.*, u.name as user_name 
                 FROM appointments a 
                 LEFT JOIN users u ON a.user_id = u.id`;
      const params = [];
      const conditions = [];
      
      if (filters.startDate) {
        conditions.push('a.appointment_date >= ?');
        params.push(filters.startDate);
      }
      
      if (filters.endDate) {
        conditions.push('a.appointment_date <= ?');
        params.push(filters.endDate);
      }
      
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      sql += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const appointments = await all(sql, params);
      const total = await get('SELECT COUNT(*) as count FROM appointments');
      
      return { appointments, total: total.count };
    },
    
    getById: async (id) => {
      return await get(
        `SELECT a.*, u.name as user_name 
         FROM appointments a 
         LEFT JOIN users u ON a.user_id = u.id
         WHERE a.id = ?`,
        [id]
      );
    }
  },
  
  // Analytics queries
  analytics: {
    getOverview: async (startDate, endDate) => {
      const totalUsers = await get('SELECT COUNT(*) as count FROM users');
      const activeUsers = await get(
        `SELECT COUNT(DISTINCT user_id) as count 
         FROM conversations 
         WHERE timestamp >= ? AND timestamp <= ?`,
        [startDate, endDate]
      );
      const totalConversations = await get(
        `SELECT COUNT(*) as count 
         FROM conversations 
         WHERE timestamp >= ? AND timestamp <= ?`,
        [startDate, endDate]
      );
      const totalAppointments = await get(
        `SELECT COUNT(*) as count 
         FROM appointments 
         WHERE created_at >= ? AND created_at <= ?`,
        [startDate, endDate]
      );
      
      return {
        totalUsers: totalUsers.count,
        activeUsers: activeUsers.count,
        totalConversations: totalConversations.count,
        totalAppointments: totalAppointments.count
      };
    },
    
    getTimeline: async (days = 7) => {
      return await all(
        `SELECT DATE(timestamp) as date, COUNT(*) as count 
         FROM conversations 
         WHERE timestamp >= datetime('now', '-${days} days')
         GROUP BY DATE(timestamp)
         ORDER BY date ASC`
      );
    },
    
    getEvents: async (limit = 100) => {
      return await all(
        `SELECT * FROM analytics 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [limit]
      );
    }
  },
  
  // Admin user queries
  admin: {
    createUser: async (username, hashedPassword) => {
      return await run(
        'INSERT INTO admin_users (username, password) VALUES (?, ?)',
        [username, hashedPassword]
      );
    },
    
    findByUsername: async (username) => {
      return await get(
        'SELECT * FROM admin_users WHERE username = ?',
        [username]
      );
    },
    
    updateLastLogin: async (userId) => {
      return await run(
        'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
      );
    },
    
    getAdminUsers: async () => {
      return await all('SELECT id, username, created_at, last_login FROM admin_users');
    }
  }
};

module.exports = queries;