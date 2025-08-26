#!/usr/bin/env node

// Migration script to add Instagram support to existing database
const { pool, testConnection } = require('../src/db-config');

async function migrateDatabase() {
  console.log('Starting database migration for Instagram support...');
  
  try {
    // Test connection
    await testConnection();
    
    // Add platform column to users table if it doesn't exist
    console.log('Adding platform column to users table...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'facebook'
    `).catch(err => {
      console.log('Platform column might already exist in users table');
    });
    
    // Add platform column to conversations table if it doesn't exist
    console.log('Adding platform column to conversations table...');
    await pool.query(`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'facebook'
    `).catch(err => {
      console.log('Platform column might already exist in conversations table');
    });
    
    // Update existing records to have 'facebook' as platform (if null)
    console.log('Updating existing records with default platform...');
    await pool.query(`
      UPDATE users 
      SET platform = 'facebook' 
      WHERE platform IS NULL
    `);
    
    await pool.query(`
      UPDATE conversations 
      SET platform = 'facebook' 
      WHERE platform IS NULL
    `);
    
    // Create indexes for better performance
    console.log('Creating indexes for platform columns...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_platform 
      ON users(platform)
    `).catch(err => {
      console.log('Index might already exist');
    });
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_platform 
      ON conversations(platform)
    `).catch(err => {
      console.log('Index might already exist');
    });
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user_platform 
      ON conversations(user_id, platform)
    `).catch(err => {
      console.log('Index might already exist');
    });
    
    // Get statistics
    const userStats = await pool.query(`
      SELECT platform, COUNT(*) as count 
      FROM users 
      GROUP BY platform
    `);
    
    const convStats = await pool.query(`
      SELECT platform, COUNT(*) as count 
      FROM conversations 
      GROUP BY platform
    `);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Statistics:');
    console.log('Users by platform:', userStats.rows);
    console.log('Conversations by platform:', convStats.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateDatabase();