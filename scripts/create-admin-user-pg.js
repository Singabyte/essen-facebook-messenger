#!/usr/bin/env node

/**
 * Create admin user in PostgreSQL database using main bot's connection
 * This script uses the same database connection as the main bot
 */

require('dotenv').config();
const { db } = require('../src/database-pg');
const bcrypt = require('bcryptjs');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'hello123';

async function createAdminUser() {
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    
    // Test connection using main bot's connection
    const testResult = await db.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL database');
    console.log(`📅 Server time: ${testResult.rows[0].now}`);

    // Hash the password
    console.log('🔐 Hashing admin password...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Check if admin user exists
    const existingAdmin = await db.query(
      'SELECT id, username FROM admin_users WHERE username = $1',
      [ADMIN_USERNAME]
    );

    if (existingAdmin.rows.length > 0) {
      // Update existing admin user password
      console.log('👤 Admin user exists, updating password...');
      await db.query(
        'UPDATE admin_users SET password = $1 WHERE username = $2',
        [hashedPassword, ADMIN_USERNAME]
      );
      console.log('✅ Admin password updated successfully!');
      console.log(`📝 User ID: ${existingAdmin.rows[0].id}`);
    } else {
      // Create new admin user
      console.log('👤 Creating new admin user...');
      const insertResult = await db.query(
        'INSERT INTO admin_users (username, password) VALUES ($1, $2) RETURNING id',
        [ADMIN_USERNAME, hashedPassword]
      );
      console.log('✅ Admin user created successfully!');
      console.log(`📝 User ID: ${insertResult.rows[0].id}`);
    }

    console.log('\n🎉 Admin user setup complete!');
    console.log(`👤 Username: ${ADMIN_USERNAME}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    console.log('\n🔗 You can now login to the admin interface');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    
    // Provide helpful error messages
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Connection refused - check if PostgreSQL is running and DATABASE_URL is correct');
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 Host not found - check your DATABASE_URL hostname');
    } else if (error.code === '28P01') {
      console.error('💡 Authentication failed - check your DATABASE_URL credentials');
    } else if (error.code === '3D000') {
      console.error('💡 Database does not exist - create the database first');
    } else if (error.code === '42P01') {
      console.error('💡 Table does not exist - run database initialization first');
    }
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };