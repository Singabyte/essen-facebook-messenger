const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection-pg');

// Get analytics overview
router.get('/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    let dateFilter = '';
    const params = [];
    let paramCount = 0;
    
    if (startDate && endDate) {
      params.push(startDate, endDate);
      dateFilter = `WHERE timestamp BETWEEN $${++paramCount} AND $${++paramCount}`;
    } else if (startDate) {
      params.push(startDate);
      dateFilter = `WHERE timestamp >= $${++paramCount}`;
    } else if (endDate) {
      params.push(endDate);
      dateFilter = `WHERE timestamp <= $${++paramCount}`;
    }
    
    // Get all metrics
    const [
      totalUsersResult,
      activeUsersResult,
      totalConversationsResult,
      totalAppointmentsResult
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM conversations 
        ${dateFilter || 'WHERE timestamp >= CURRENT_DATE - INTERVAL \'30 days\''}
      `, params),
      pool.query(`SELECT COUNT(*) as count FROM conversations ${dateFilter}`, params),
      pool.query(`SELECT COUNT(*) as count FROM appointments ${dateFilter.replace('timestamp', 'created_at')}`, params)
    ]);
    
    res.json({
      totalUsers: parseInt(totalUsersResult.rows[0]?.count || 0),
      activeUsers: parseInt(activeUsersResult.rows[0]?.count || 0),
      totalConversations: parseInt(totalConversationsResult.rows[0]?.count || 0),
      totalAppointments: parseInt(totalAppointmentsResult.rows[0]?.count || 0),
      averageResponseTime: 0, // Would require tracking response times
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
});

// Get usage timeline
router.get('/timeline', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // Calculate date range based on period
    let interval;
    switch(period) {
      case '24h': interval = '1 day'; break;
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      default: interval = '7 days';
    }
    
    const query = `
      SELECT 
        DATE_TRUNC('day', timestamp) as date,
        COUNT(*) as conversations,
        COUNT(DISTINCT user_id) as unique_users
      FROM conversations
      WHERE timestamp >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      timeline: result.rows.map(row => ({
        date: row.date,
        conversations: parseInt(row.conversations),
        users: parseInt(row.unique_users)
      })),
      period
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ message: 'Error fetching timeline', error: error.message });
  }
});

// Get command usage
router.get('/commands', async (req, res) => {
  try {
    const query = `
      SELECT 
        CASE 
          WHEN message LIKE '/%' THEN SPLIT_PART(message, ' ', 1)
          ELSE 'general conversation'
        END as command,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM conversations
      WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY command
      ORDER BY count DESC
      LIMIT 20
    `;
    
    const result = await pool.query(query);
    
    const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    res.json({
      commands: result.rows.map(row => ({
        command: row.command,
        count: parseInt(row.count),
        users: parseInt(row.unique_users),
        percentage: total > 0 ? (parseInt(row.count) / total * 100).toFixed(1) : 0
      })),
      total
    });
  } catch (error) {
    console.error('Error fetching command usage:', error);
    res.status(500).json({ message: 'Error fetching command usage', error: error.message });
  }
});

// Export analytics data
router.get('/export', async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;
    // TODO: Implement export functionality
    res.json({ message: 'Export feature coming soon' });
  } catch (error) {
    res.status(500).json({ message: 'Error exporting data', error: error.message });
  }
});

module.exports = router;