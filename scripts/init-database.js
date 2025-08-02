#!/usr/bin/env node

/**
 * Database initialization script for ESSEN Facebook Messenger Bot
 * This script sets up the required database schema including analytics
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Execute SQL from file
 */
async function executeSQLFile(filePath) {
  try {
    const sql = await fs.readFile(filePath, 'utf8');
    console.log(`Executing ${path.basename(filePath)}...`);
    
    // Split by semicolons but preserve those in strings
    const statements = sql
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .filter(stmt => stmt.trim())
      .map(stmt => stmt.trim() + ';');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      if (statement.trim() && !statement.startsWith('--')) {
        try {
          await pool.query(statement);
          successCount++;
        } catch (error) {
          console.error(`Error executing statement: ${error.message}`);
          console.error(`Statement preview: ${statement.substring(0, 100)}...`);
          errorCount++;
        }
      }
    }
    
    console.log(`✓ ${path.basename(filePath)}: ${successCount} statements executed, ${errorCount} errors`);
    return { success: successCount, errors: errorCount };
  } catch (error) {
    console.error(`Failed to read/execute ${filePath}: ${error.message}`);
    return { success: 0, errors: 1 };
  }
}

/**
 * Check if schema exists
 */
async function schemaExists(schemaName) {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.schemata 
      WHERE schema_name = $1
    )
  `, [schemaName]);
  return result.rows[0].exists;
}

/**
 * Main initialization function
 */
async function main() {
  console.log('=== ESSEN Bot Database Initialization ===');
  console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'local'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}\n`);
  
  try {
    // Check database connection
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful\n');
    
    // Check if analytics schema exists
    const analyticsExists = await schemaExists('analytics');
    
    if (!analyticsExists) {
      console.log('Analytics schema not found. Creating...\n');
      
      // Execute SQL files
      const sqlDir = path.join(__dirname, '..', 'sql');
      const results = {
        total: { success: 0, errors: 0 }
      };
      
      // Execute in order
      const files = [
        'analytics-schema.sql',
        'monitoring-views.sql',
        'performance-indexes.sql'
      ];
      
      for (const file of files) {
        const filePath = path.join(sqlDir, file);
        try {
          const result = await executeSQLFile(filePath);
          results.total.success += result.success;
          results.total.errors += result.errors;
        } catch (error) {
          console.error(`Skipping ${file}: ${error.message}`);
          results.total.errors++;
        }
      }
      
      console.log('\n=== Summary ===');
      console.log(`Total statements executed: ${results.total.success}`);
      console.log(`Total errors: ${results.total.errors}`);
      
      if (results.total.errors === 0) {
        console.log('\n✅ Database initialization completed successfully!');
      } else {
        console.log('\n⚠️  Database initialization completed with errors');
        console.log('Some features may not work correctly. Please check the errors above.');
      }
    } else {
      console.log('✓ Analytics schema already exists');
      
      // Check for missing views
      const viewChecks = [
        'v_conversion_funnel',
        'v_user_behavior_patterns',
        'v_product_trends',
        'v_system_health'
      ];
      
      console.log('\nChecking for required views...');
      for (const viewName of viewChecks) {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.views 
            WHERE table_schema = 'analytics' 
            AND table_name = $1
          )
        `, [viewName]);
        
        if (result.rows[0].exists) {
          console.log(`✓ ${viewName}`);
        } else {
          console.log(`✗ ${viewName} - missing`);
        }
      }
      
      console.log('\nRun "npm run setup:monitoring" to recreate missing views');
    }
    
    // Initialize user engagement data if needed
    const userEngagementCount = await pool.query(`
      SELECT COUNT(*) FROM analytics.user_engagement
    `);
    
    if (parseInt(userEngagementCount.rows[0].count) === 0) {
      console.log('\nInitializing user engagement data...');
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
      console.log('✓ User engagement data initialized');
    }
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main };