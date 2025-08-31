const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection-pg');
const queries = require('../db/queries-pg');

// Get analytics overview
router.get('/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const overview = await queries.analytics.getOverview(startDate, endDate);
    res.json(overview);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
});

// Get business metrics
router.get('/business-metrics', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const metrics = await queries.analytics.getBusinessMetrics(parseInt(days));
    res.json({ metrics, period: `${days} days` });
  } catch (error) {
    console.error('Error fetching business metrics:', error);
    res.status(500).json({ message: 'Error fetching business metrics', error: error.message });
  }
});

// Get user engagement analytics
router.get('/user-engagement', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const engagement = await queries.analytics.getUserEngagement(parseInt(limit));
    res.json({ users: engagement, total: engagement.length });
  } catch (error) {
    console.error('Error fetching user engagement:', error);
    res.status(500).json({ message: 'Error fetching user engagement', error: error.message });
  }
});

// Get conversion funnel
router.get('/conversion-funnel', async (req, res) => {
  try {
    const funnel = await queries.analytics.getConversionFunnel();
    res.json(funnel);
  } catch (error) {
    console.error('Error fetching conversion funnel:', error);
    res.status(500).json({ message: 'Error fetching conversion funnel', error: error.message });
  }
});

// Get product inquiry trends
router.get('/product-trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trends = await queries.analytics.getProductTrends(parseInt(days));
    res.json({ trends, period: `${days} days` });
  } catch (error) {
    console.error('Error fetching product trends:', error);
    res.status(500).json({ message: 'Error fetching product trends', error: error.message });
  }
});


// Get peak usage hours
router.get('/peak-hours', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const peakHours = await queries.analytics.getPeakUsageHours(parseInt(days));
    res.json({ hours: peakHours, period: `${days} days` });
  } catch (error) {
    console.error('Error fetching peak hours:', error);
    res.status(500).json({ message: 'Error fetching peak hours', error: error.message });
  }
});

// Get user satisfaction metrics
router.get('/satisfaction', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const satisfaction = await queries.analytics.getUserSatisfactionMetrics(parseInt(days));
    res.json({ ...satisfaction, period: `${days} days` });
  } catch (error) {
    console.error('Error fetching satisfaction metrics:', error);
    res.status(500).json({ message: 'Error fetching satisfaction metrics', error: error.message });
  }
});

// Get performance metrics
router.get('/performance', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const performance = await queries.analytics.getPerformanceMetrics(parseInt(days));
    res.json({ metrics: performance, period: `${days} days` });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ message: 'Error fetching performance metrics', error: error.message });
  }
});

// Get database statistics
router.get('/database-stats', async (req, res) => {
  try {
    const stats = await queries.analytics.getDatabaseStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching database stats:', error);
    res.status(500).json({ message: 'Error fetching database stats', error: error.message });
  }
});

// Get slow queries
router.get('/slow-queries', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const slowQueries = await queries.analytics.getSlowQueries(parseInt(limit));
    res.json({ queries: slowQueries, total: slowQueries.length });
  } catch (error) {
    console.error('Error fetching slow queries:', error);
    res.status(500).json({ message: 'Error fetching slow queries', error: error.message });
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

// Get predictive analytics
router.get('/predictions', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    

    // Predict peak usage times
    const usagePrediction = await pool.query(`
      WITH hourly_patterns AS (
        SELECT 
          EXTRACT(HOUR FROM timestamp) as hour,
          EXTRACT(DOW FROM timestamp) as day_of_week,
          COUNT(*) as messages
        FROM conversations
        WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM timestamp), EXTRACT(DOW FROM timestamp)
      )
      SELECT 
        hour,
        AVG(messages) as avg_messages,
        ARRAY_AGG(DISTINCT day_of_week ORDER BY day_of_week) as active_days
      FROM hourly_patterns
      GROUP BY hour
      ORDER BY avg_messages DESC
      LIMIT 5
    `);

    // Identify high-value customer patterns
    const customerValue = await pool.query(`
      WITH user_value AS (
        SELECT 
          u.id,
          u.name,
          COUNT(DISTINCT c.id) as total_conversations,
          CASE 
            WHEN COUNT(DISTINCT c.id) > 20 THEN 'High Value'
            WHEN COUNT(DISTINCT c.id) > 10 THEN 'Engaged'
            WHEN COUNT(DISTINCT c.id) > 3 THEN 'Interested'
            ELSE 'Low Engagement'
          END as value_segment
        FROM users u
        LEFT JOIN conversations c ON u.id = c.user_id
        WHERE u.last_interaction >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY u.id, u.name
      )
      SELECT 
        value_segment,
        COUNT(*) as user_count,
        CASE 
          WHEN SUM(COUNT(*)) OVER () > 0 
          THEN ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)
          ELSE 0
        END as percentage
      FROM user_value
      GROUP BY value_segment
      ORDER BY user_count DESC
    `);

    res.json({
      peak_hours: usagePrediction.rows,
      customer_segments: customerValue.rows,
      prediction_period: `${days} days`,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating predictions:', error);
    res.status(500).json({ message: 'Error generating predictions', error: error.message });
  }
});

// Export analytics data
router.get('/export', async (req, res) => {
  try {
    const { format = 'csv', type = 'overview', startDate, endDate } = req.query;
    
    let data = [];
    let filename = 'analytics_export';
    
    switch (type) {
      case 'conversations':
        const conversations = await pool.query(`
          SELECT 
            c.id,
            c.user_id,
            u.name as user_name,
            c.message,
            c.response,
            c.timestamp
          FROM conversations c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE ($1::date IS NULL OR c.timestamp >= $1::date)
            AND ($2::date IS NULL OR c.timestamp <= $2::date)
          ORDER BY c.timestamp DESC
        `, [startDate, endDate]);
        data = conversations.rows;
        filename = 'conversations_export';
        break;
        
        
      case 'user_engagement':
        const engagement = await queries.analytics.getUserEngagement(1000);
        data = engagement;
        filename = 'user_engagement_export';
        break;
        
      case 'product_trends':
        const trends = await queries.analytics.getProductTrends(90);
        data = trends;
        filename = 'product_trends_export';
        break;
        
      default:
        const overview = await queries.analytics.getOverview(startDate, endDate);
        data = [overview];
        filename = 'analytics_overview_export';
    }

    if (format === 'csv') {
      const createCsvWriter = require('csv-writer').createObjectCsvWriter;
      const fs = require('fs');
      const path = require('path');
      
      if (data.length === 0) {
        return res.status(404).json({ message: 'No data found for export' });
      }
      
      const headers = Object.keys(data[0]).map(key => ({ id: key, title: key }));
      const csvPath = path.join(__dirname, '..', '..', 'temp', `${filename}_${Date.now()}.csv`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(csvPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const csvWriter = createCsvWriter({
        path: csvPath,
        header: headers
      });
      
      await csvWriter.writeRecords(data);
      
      res.download(csvPath, `${filename}.csv`, (err) => {
        if (err) {
          console.error('Error downloading CSV:', err);
        }
        // Clean up temporary file
        fs.unlink(csvPath, (unlinkErr) => {
          if (unlinkErr) console.error('Error cleaning up temp file:', unlinkErr);
        });
      });
    } else {
      // JSON export
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json({
        export_type: type,
        export_date: new Date().toISOString(),
        period: { startDate, endDate },
        data: data
      });
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ message: 'Error exporting data', error: error.message });
  }
});

// Generate business intelligence report
router.get('/business-report', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    
    // Get comprehensive business data
    const [
      overview,
      conversion,
      productTrends,
      peakHours,
      satisfaction,
      businessMetrics
    ] = await Promise.all([
      queries.analytics.getOverview(),
      queries.analytics.getConversionFunnel(),
      queries.analytics.getProductTrends(days),
      queries.analytics.getPeakUsageHours(days),
      queries.analytics.getUserSatisfactionMetrics(days),
      queries.analytics.getBusinessMetrics(days)
    ]);

    // Calculate growth rates if we have historical data
    let growthMetrics = {};
    if (businessMetrics.length >= 7) {
      const recentWeek = businessMetrics.slice(0, 7);
      const previousWeek = businessMetrics.slice(7, 14);
      
      const recentAvg = recentWeek.reduce((sum, day) => sum + day.total_conversations, 0) / 7;
      const previousAvg = previousWeek.reduce((sum, day) => sum + day.total_conversations, 0) / 7;
      
      growthMetrics = {
        conversation_growth: previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg * 100).toFixed(2) : 0,
        trend: recentAvg > previousAvg ? 'increasing' : 'decreasing'
      };
    }

    const report = {
      report_generated: new Date().toISOString(),
      period: `${days} days`,
      executive_summary: {
        total_users: overview.totalUsers,
        active_users: overview.activeUsers,
        total_conversations: overview.totalConversations,
        conversion_rate: conversion.booking_rate || 0,
        satisfaction_rate: satisfaction.satisfaction_rate || 0
      },
      growth_metrics: growthMetrics,
      conversion_funnel: conversion,
      product_performance: {
        top_products: productTrends.slice(0, 5),
        trending: productTrends.filter(p => p.avg_daily_mentions > 1)
      },
      operational_insights: {
        peak_hours: peakHours.slice(0, 5),
        user_satisfaction: satisfaction,
        engagement_quality: businessMetrics.length > 0 ? {
          avg_session_length: businessMetrics[0]?.avg_session_length || 0,
          popular_products: businessMetrics[0]?.popular_products || []
        } : {}
      },
      recommendations: generateRecommendations(conversion, satisfaction, productTrends, peakHours)
    };

    res.json(report);
  } catch (error) {
    console.error('Error generating business report:', error);
    res.status(500).json({ message: 'Error generating business report', error: error.message });
  }
});

function generateRecommendations(conversion, satisfaction, productTrends, peakHours) {
  const recommendations = [];
  
  // Conversion optimization
  if (conversion.booking_rate < 20) {
    recommendations.push({
      category: 'Conversion Optimization',
      priority: 'High',
      recommendation: 'Conversion rate is below 20%. Consider improving user engagement flow or adding incentives.',
      metric: `Current rate: ${conversion.booking_rate}%`
    });
  }
  
  // Satisfaction improvement
  if (satisfaction.satisfaction_rate < 70) {
    recommendations.push({
      category: 'Customer Satisfaction',
      priority: 'High',
      recommendation: 'Customer satisfaction is below 70%. Review common issues and improve response quality.',
      metric: `Current rate: ${satisfaction.satisfaction_rate}%`
    });
  }
  
  // Product focus
  if (productTrends.length > 0) {
    const topProduct = productTrends[0];
    recommendations.push({
      category: 'Product Marketing',
      priority: 'Medium',
      recommendation: `Focus marketing efforts on ${topProduct.product_category} as it has the highest inquiry volume.`,
      metric: `${topProduct.total_mentions} mentions in the period`
    });
  }
  
  // Staffing optimization
  if (peakHours.length > 0) {
    const topHour = peakHours[0];
    recommendations.push({
      category: 'Operational Efficiency',
      priority: 'Medium',
      recommendation: `Ensure adequate staffing during ${topHour.hour}:00 hour as it has the highest activity.`,
      metric: `${topHour.message_count} messages during this hour`
    });
  }
  
  return recommendations;
}

module.exports = router;