#!/usr/bin/env node

/**
 * ESSEN Facebook Messenger Bot - Monitoring Setup Script
 * This script initializes all monitoring and analytics features
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'monitoring-setup.log' })
  ]
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Execute SQL file
 */
async function executeSQLFile(filePath, description) {
  try {
    logger.info(`Executing ${description}...`);
    const sql = await fs.readFile(filePath, 'utf8');
    
    // Split by semicolons but ignore those in strings
    const statements = sql
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .filter(stmt => stmt.trim())
      .map(stmt => stmt.trim() + ';');
    
    for (const statement of statements) {
      if (statement.trim() && !statement.startsWith('--')) {
        try {
          await pool.query(statement);
        } catch (error) {
          logger.error(`Error executing statement: ${error.message}`);
          logger.error(`Statement: ${statement.substring(0, 100)}...`);
          // Continue with other statements
        }
      }
    }
    
    logger.info(`✓ ${description} completed successfully`);
  } catch (error) {
    logger.error(`✗ Failed to execute ${description}: ${error.message}`);
    throw error;
  }
}

/**
 * Check if monitoring is already set up
 */
async function checkExistingSetup() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.schemata 
        WHERE schema_name = 'analytics'
      ) as analytics_exists
    `);
    return result.rows[0].analytics_exists;
  } catch (error) {
    logger.error('Error checking existing setup:', error.message);
    return false;
  }
}

/**
 * Create initial monitoring data
 */
async function seedMonitoringData() {
  try {
    logger.info('Creating initial monitoring data...');
    
    // Initialize user engagement data
    await pool.query(`
      INSERT INTO analytics.user_engagement (
        user_id, first_interaction, last_interaction, 
        total_conversations, total_messages, total_appointments,
        confirmed_appointments, engagement_score, customer_segment
      )
      SELECT 
        u.id,
        MIN(c.created_at),
        MAX(c.created_at),
        COUNT(DISTINCT DATE(c.created_at)),
        COUNT(c.id),
        COUNT(DISTINCT a.id),
        COUNT(DISTINCT CASE WHEN a.status = 'confirmed' THEN a.id END),
        0,
        'New'
      FROM users u
      LEFT JOIN conversations c ON u.id = c.user_id
      LEFT JOIN appointments a ON u.id = a.user_id
      GROUP BY u.id
      ON CONFLICT (user_id) DO NOTHING
    `);
    
    // Update customer segments
    await pool.query('SELECT analytics.segment_users()');
    
    // Generate initial business metrics
    await pool.query('SELECT analytics.update_business_metrics_daily()');
    
    logger.info('✓ Initial monitoring data created');
  } catch (error) {
    logger.error('Error creating monitoring data:', error.message);
    // Non-critical error, continue
  }
}

/**
 * Setup scheduled jobs
 */
async function setupScheduledJobs() {
  try {
    logger.info('Setting up scheduled jobs...');
    
    // Check if pg_cron is available
    const cronResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_extension WHERE extname = 'pg_cron'
      ) as has_pg_cron
    `);
    
    if (cronResult.rows[0].has_pg_cron) {
      // Schedule daily metrics update
      await pool.query(`
        SELECT cron.schedule(
          'update-business-metrics',
          '0 1 * * *',
          'SELECT analytics.update_business_metrics_daily();'
        )
      `);
      
      // Schedule user segmentation
      await pool.query(`
        SELECT cron.schedule(
          'segment-users',
          '0 2 * * *',
          'SELECT analytics.segment_users();'
        )
      `);
      
      // Schedule materialized view refresh
      await pool.query(`
        SELECT cron.schedule(
          'refresh-user-behavior',
          '*/30 * * * *',
          'REFRESH MATERIALIZED VIEW analytics.mv_user_behavior_patterns;'
        )
      `);
      
      logger.info('✓ Scheduled jobs created with pg_cron');
    } else {
      logger.warn('⚠ pg_cron not available - use external scheduler for periodic tasks');
      
      // Create a cron script for external scheduling
      const cronScript = `#!/bin/bash
# ESSEN Bot Monitoring Cron Jobs
# Add these to your system crontab or use a process manager

# Update business metrics daily at 1 AM
0 1 * * * psql $DATABASE_URL -c "SELECT analytics.update_business_metrics_daily();"

# Segment users daily at 2 AM
0 2 * * * psql $DATABASE_URL -c "SELECT analytics.segment_users();"

# Refresh materialized views every 30 minutes
*/30 * * * * psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW analytics.mv_user_behavior_patterns;"

# Archive old data monthly
0 3 1 * * node ${path.join(__dirname, 'archive-old-data.js')}

# Database maintenance weekly
0 4 * * 0 psql $DATABASE_URL -c "VACUUM ANALYZE;"
`;
      
      await fs.writeFile(path.join(__dirname, 'monitoring-cron.sh'), cronScript, { mode: 0o755 });
      logger.info('✓ Created monitoring-cron.sh for external scheduling');
    }
  } catch (error) {
    logger.error('Error setting up scheduled jobs:', error.message);
    // Non-critical error, continue
  }
}

/**
 * Verify monitoring setup
 */
async function verifySetup() {
  try {
    logger.info('Verifying monitoring setup...');
    
    const checks = [
      { name: 'Analytics schema', query: "SELECT EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'analytics')" },
      { name: 'Performance metrics table', query: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'analytics' AND table_name = 'performance_metrics')" },
      { name: 'Business metrics view', query: "SELECT EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'analytics' AND table_name = 'v_system_health')" },
      { name: 'User behavior materialized view', query: "SELECT EXISTS (SELECT FROM pg_matviews WHERE schemaname = 'analytics' AND matviewname = 'mv_user_behavior_patterns')" }
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
      try {
        const result = await pool.query(check.query);
        const exists = result.rows[0].exists;
        logger.info(`  ${exists ? '✓' : '✗'} ${check.name}`);
        if (!exists) allPassed = false;
      } catch (error) {
        logger.error(`  ✗ ${check.name}: ${error.message}`);
        allPassed = false;
      }
    }
    
    return allPassed;
  } catch (error) {
    logger.error('Error verifying setup:', error.message);
    return false;
  }
}

/**
 * Main setup function
 */
async function main() {
  try {
    logger.info('=== ESSEN Bot Monitoring Setup ===');
    logger.info(`Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'local'}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Check if already set up
    const exists = await checkExistingSetup();
    if (exists) {
      logger.warn('⚠ Analytics schema already exists. Skipping schema creation...');
    } else {
      // Execute SQL scripts in order
      const sqlDir = path.join(__dirname, '..', 'sql');
      await executeSQLFile(path.join(sqlDir, 'analytics-schema.sql'), 'Analytics schema');
      await executeSQLFile(path.join(sqlDir, 'monitoring-views.sql'), 'Monitoring views');
      await executeSQLFile(path.join(sqlDir, 'performance-indexes.sql'), 'Performance indexes');
    }
    
    // Always try to seed data and setup jobs
    await seedMonitoringData();
    await setupScheduledJobs();
    
    // Verify setup
    const verified = await verifySetup();
    
    if (verified) {
      logger.info('\n✅ Monitoring setup completed successfully!');
      logger.info('\nNext steps:');
      logger.info('1. Restart the bot to enable monitoring features');
      logger.info('2. Access monitoring dashboard at /admin/monitoring');
      logger.info('3. Configure alerting in environment variables');
      logger.info('4. Set up external monitoring (UptimeRobot, Datadog, etc.)');
      
      if (!process.env.SLACK_WEBHOOK_URL) {
        logger.warn('\n⚠ SLACK_WEBHOOK_URL not configured - alerts will only be logged');
      }
    } else {
      logger.error('\n✗ Monitoring setup verification failed');
      logger.error('Please check the errors above and run the script again');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Fatal error during setup:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main };