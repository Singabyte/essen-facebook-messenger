#!/usr/bin/env node

/**
 * Apply bot control migration to the database
 * This script adds fields for controlling bot behavior per user
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// For production environments with self-signed certificates (DigitalOcean)
if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('digitalocean')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false,
    require: true,
    requestCert: false
  } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

async function applyMigration() {
  try {
    console.log('🔄 Applying bot control migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'sql', 'add-bot-control.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    console.log('\nNew features added:');
    console.log('  • bot_enabled field on users table');
    console.log('  • admin_takeover field on users table');
    console.log('  • admin_takeover_at timestamp field');
    console.log('  • admin_takeover_by field for tracking admin');
    console.log('  • is_admin_message field on conversations table');
    console.log('  • admin_id field on conversations table');
    console.log('  • Indexes for optimized queries');
    
    // Verify the migration
    const verifyQuery = `
      SELECT 
        column_name, 
        data_type, 
        column_default
      FROM information_schema.columns
      WHERE table_name = 'users' 
        AND column_name IN ('bot_enabled', 'admin_takeover', 'admin_takeover_at', 'admin_takeover_by')
      ORDER BY column_name;
    `;
    
    const result = await pool.query(verifyQuery);
    
    if (result.rows.length > 0) {
      console.log('\n✅ Verification successful! New columns found:');
      result.rows.forEach(col => {
        console.log(`  • ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('\n⚠️  Warning: Could not verify new columns. They may already exist or the migration may have failed.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
applyMigration().then(() => {
  console.log('\n✅ Migration complete!');
  console.log('\nNext steps:');
  console.log('1. Restart the bot server to use the new database schema');
  console.log('2. Restart the admin server to enable new features');
  console.log('3. Test the bot control and messaging features in the admin interface');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});