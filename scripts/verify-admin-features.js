#!/usr/bin/env node

/**
 * Verify that admin messaging features are properly configured
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false
});

async function verifyAdminFeatures() {
  try {
    console.log('🔍 Verifying admin messaging features...\n');
    
    // 1. Check if required columns exist in users table
    console.log('1. Checking users table columns...');
    const userColumnsQuery = `
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('bot_enabled', 'admin_takeover', 'admin_takeover_at', 'admin_takeover_by')
      ORDER BY column_name;
    `;
    
    const userColumns = await pool.query(userColumnsQuery);
    
    if (userColumns.rows.length === 0) {
      console.log('❌ Missing columns in users table!');
      console.log('   Run: node scripts/apply-bot-control-migration.js');
    } else {
      console.log('✅ Users table columns found:');
      userColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    }
    
    // 2. Check if required columns exist in conversations table
    console.log('\n2. Checking conversations table columns...');
    const convColumnsQuery = `
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
      AND column_name IN ('is_from_user', 'is_admin_message', 'admin_id')
      ORDER BY column_name;
    `;
    
    const convColumns = await pool.query(convColumnsQuery);
    
    if (convColumns.rows.length === 0) {
      console.log('❌ Missing columns in conversations table!');
      console.log('   Run: node scripts/apply-bot-control-migration.js');
    } else {
      console.log('✅ Conversations table columns found:');
      convColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    }
    
    // 3. Test a sample query for getting bot status
    console.log('\n3. Testing bot status query...');
    try {
      const testQuery = `
        SELECT id, name, bot_enabled, admin_takeover 
        FROM users 
        LIMIT 1;
      `;
      const result = await pool.query(testQuery);
      console.log('✅ Bot status query works');
      if (result.rows[0]) {
        console.log(`   Sample user: ${result.rows[0].name || 'Unknown'}`);
        console.log(`   Bot enabled: ${result.rows[0].bot_enabled !== false}`);
        console.log(`   Admin takeover: ${result.rows[0].admin_takeover === true}`);
      }
    } catch (error) {
      console.log('❌ Bot status query failed:', error.message);
    }
    
    // 4. Test saving an admin message
    console.log('\n4. Testing admin message save (dry run)...');
    try {
      // Just test the query syntax, don't actually insert
      const testQuery = `
        EXPLAIN (FORMAT JSON)
        INSERT INTO conversations (
          user_id, message, response, timestamp, 
          is_from_user, is_admin_message, admin_id
        ) VALUES ($1, $2, $3, NOW(), $4, $5, $6)
        RETURNING *;
      `;
      await pool.query(testQuery, ['test', '', 'test', false, true, 'admin']);
      console.log('✅ Admin message query syntax is valid');
    } catch (error) {
      console.log('❌ Admin message query failed:', error.message);
      console.log('   This might be due to missing columns');
    }
    
    // 5. Check environment variables
    console.log('\n5. Checking environment variables...');
    const requiredEnvVars = ['PAGE_ACCESS_TOKEN', 'DATABASE_URL'];
    const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
    
    if (missingEnvVars.length > 0) {
      console.log('❌ Missing environment variables:');
      missingEnvVars.forEach(v => console.log(`   - ${v}`));
    } else {
      console.log('✅ All required environment variables are set');
    }
    
    // 6. Check if any users have bot disabled
    console.log('\n6. Checking bot status for users...');
    const botStatusQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE bot_enabled = false) as bot_disabled_count,
        COUNT(*) FILTER (WHERE admin_takeover = true) as admin_takeover_count
      FROM users;
    `;
    
    const botStatus = await pool.query(botStatusQuery);
    const stats = botStatus.rows[0];
    console.log(`   Total users: ${stats.total_users}`);
    console.log(`   Bot disabled for: ${stats.bot_disabled_count} users`);
    console.log(`   Admin takeover active: ${stats.admin_takeover_count} users`);
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    
    const allGood = userColumns.rows.length > 0 && 
                   convColumns.rows.length > 0 && 
                   missingEnvVars.length === 0;
    
    if (allGood) {
      console.log('✅ Admin messaging features are properly configured!');
      console.log('\nYou can now:');
      console.log('  1. Toggle bot on/off for specific users');
      console.log('  2. Send messages directly from the admin interface');
      console.log('  3. View real-time conversations');
    } else {
      console.log('⚠️  Some features may not work properly.');
      console.log('\nPlease fix the issues above and try again.');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  } finally {
    await pool.end();
  }
}

// Run verification
verifyAdminFeatures().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});