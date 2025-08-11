#!/usr/bin/env node

/**
 * Quick fix script for chat interface issues
 * Run this directly on production to apply database fixes
 */

require('dotenv').config();
const { Pool } = require('pg');

// Parse DATABASE_URL to handle SSL properly
const connectionString = process.env.DATABASE_URL || '';
const isProduction = connectionString.includes('digitalocean') || 
                     connectionString.includes('ondigitalocean') ||
                     process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? {
    rejectUnauthorized: false,
    // DigitalOcean managed databases use self-signed certificates
    // This is safe for managed databases but verify the connection string
  } : false
});

async function applyFixes() {
  console.log('🔧 Applying chat interface fixes...\n');
  
  try {
    // Check current schema
    console.log('📋 Checking current database schema...');
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'conversations'
      AND column_name IN ('is_from_user', 'is_admin_message', 'admin_id')
    `);
    
    console.log('Current columns found:', schemaCheck.rows.length);
    schemaCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Apply migrations
    console.log('\n🚀 Applying database migrations...');
    
    // Add is_from_user column
    try {
      await pool.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS is_from_user BOOLEAN DEFAULT true
      `);
      console.log('✅ Added is_from_user column');
    } catch (err) {
      if (err.code === '42701') { // Column already exists
        console.log('ℹ️  is_from_user column already exists');
      } else {
        throw err;
      }
    }
    
    // Add is_admin_message column
    try {
      await pool.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS is_admin_message BOOLEAN DEFAULT false
      `);
      console.log('✅ Added is_admin_message column');
    } catch (err) {
      if (err.code === '42701') {
        console.log('ℹ️  is_admin_message column already exists');
      } else {
        throw err;
      }
    }
    
    // Add admin_id column
    try {
      await pool.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS admin_id VARCHAR(255)
      `);
      console.log('✅ Added admin_id column');
    } catch (err) {
      if (err.code === '42701') {
        console.log('ℹ️  admin_id column already exists');
      } else {
        throw err;
      }
    }
    
    // Create index for performance
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_admin_messages 
        ON conversations(user_id, is_admin_message) 
        WHERE is_admin_message = true
      `);
      console.log('✅ Created admin messages index');
    } catch (err) {
      console.log('ℹ️  Index might already exist:', err.message);
    }
    
    // Update existing records
    console.log('\n📝 Updating existing records...');
    const updateResult = await pool.query(`
      UPDATE conversations 
      SET is_from_user = true,
          is_admin_message = false
      WHERE is_from_user IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} existing records`);
    
    // Verify the fix
    console.log('\n🔍 Verifying fixes...');
    const verifyCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(is_from_user) as has_from_user,
        COUNT(is_admin_message) as has_admin_message,
        COUNT(admin_id) as has_admin_id
      FROM conversations
      LIMIT 1
    `);
    
    const verify = verifyCheck.rows[0];
    console.log('Verification results:');
    console.log(`  Total conversations: ${verify.total_conversations}`);
    console.log(`  With is_from_user: ${verify.has_from_user}`);
    console.log(`  With is_admin_message: ${verify.has_admin_message}`);
    console.log(`  With admin_id: ${verify.has_admin_id}`);
    
    // Test query
    console.log('\n🧪 Testing query functionality...');
    const testQuery = await pool.query(`
      SELECT 
        c.id,
        c.message,
        c.response,
        CASE 
          WHEN c.is_from_user IS NOT NULL THEN c.is_from_user
          WHEN c.message IS NOT NULL AND c.message != '' THEN true
          ELSE false
        END as is_from_user,
        COALESCE(c.is_admin_message, false) as is_admin_message
      FROM conversations c
      LIMIT 5
    `);
    console.log(`✅ Query test successful - returned ${testQuery.rows.length} rows`);
    
    console.log('\n✨ All fixes applied successfully!');
    console.log('\n📌 Next steps:');
    console.log('1. Restart the admin server if needed');
    console.log('2. Clear browser cache and reload admin interface');
    console.log('3. Test the chat interface functionality');
    
  } catch (error) {
    console.error('\n❌ Error applying fixes:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the fixes
applyFixes().catch(console.error);