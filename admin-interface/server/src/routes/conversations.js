const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection-pg');

// Get all conversations
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, platform, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        c.id,
        c.user_id,
        c.message,
        c.response,
        c.timestamp,
        c.platform,
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
    
    if (platform) {
      params.push(platform);
      query += ` AND c.platform = $${++paramCount}`;
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
    const countQuery = query.replace('SELECT c.id, c.user_id, c.message, c.response, c.timestamp, c.platform, u.name as user_name, u.profile_pic', 'SELECT COUNT(*) as total');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0);
    
    // Get paginated results
    query += ` ORDER BY c.timestamp DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      conversations: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
});

// Search conversations
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    if (!q) {
      return res.json({
        results: [],
        total: 0,
        query: q
      });
    }
    
    const searchQuery = `
      SELECT 
        c.id,
        c.user_id,
        c.message,
        c.response,
        c.timestamp,
        c.platform,
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
    
    const searchTerm = `%${q}%`;
    
    const [result, countResult] = await Promise.all([
      pool.query(searchQuery, [searchTerm, parseInt(limit), offset]),
      pool.query(countQuery, [searchTerm])
    ]);
    
    res.json({
      results: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0),
      query: q
    });
  } catch (error) {
    console.error('Error searching conversations:', error);
    res.status(500).json({ message: 'Error searching conversations', error: error.message });
  }
});

// Get conversation stats
router.get('/stats', async (req, res) => {
  try {
    // Get total conversations
    const totalQuery = `SELECT COUNT(*) as total FROM conversations`;
    const totalResult = await pool.query(totalQuery);
    
    // Get today's conversations
    const todayQuery = `
      SELECT COUNT(*) as total 
      FROM conversations 
      WHERE DATE(timestamp) = CURRENT_DATE
    `;
    const todayResult = await pool.query(todayQuery);
    
    // Get popular commands
    const commandsQuery = `
      SELECT 
        CASE 
          WHEN message LIKE '/%' THEN SPLIT_PART(message, ' ', 1)
          ELSE 'general'
        END as command,
        COUNT(*) as count
      FROM conversations
      WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY command
      ORDER BY count DESC
      LIMIT 10
    `;
    const commandsResult = await pool.query(commandsQuery);
    
    res.json({
      totalConversations: parseInt(totalResult.rows[0]?.total || 0),
      todayConversations: parseInt(todayResult.rows[0]?.total || 0),
      averageResponseTime: 0, // This would require tracking response times
      popularCommands: commandsResult.rows
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
});

module.exports = router;