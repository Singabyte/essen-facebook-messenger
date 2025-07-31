#!/usr/bin/env node

/**
 * PostgreSQL Admin User Creation Script
 * Creates or updates the admin user in PostgreSQL database
 * Handles SSL connections for DigitalOcean and other cloud providers
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'hello123';

// For production environments with self-signed certificates
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required');
  console.error('Please set DATABASE_URL in your .env file');
  process.exit(1);
}

// PostgreSQL connection with SSL support
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false
  } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function createAdminUser() {
  let client;
  
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    client = await pool.connect();
    
    // Test connection
    const result = await client.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL database');
    console.log(`📅 Server time: ${result.rows[0].now}`);

    // Create admin_users table if it doesn't exist
    console.log('📋 Creating admin_users table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    console.log('✅ admin_users table ready');

    // Create audit_logs table if it doesn't exist (used by admin interface)
    console.log('📋 Creating audit_logs table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES admin_users(id),
        action VARCHAR(255) NOT NULL,
        resource VARCHAR(255),
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ audit_logs table ready');

    // Hash the password
    console.log('🔐 Hashing admin password...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Check if admin user exists
    const existingAdmin = await client.query(
      'SELECT id, username FROM admin_users WHERE username = $1',
      [ADMIN_USERNAME]
    );

    if (existingAdmin.rows.length > 0) {
      // Update existing admin user password
      console.log('👤 Admin user exists, updating password...');
      await client.query(
        'UPDATE admin_users SET password = $1 WHERE username = $2',
        [hashedPassword, ADMIN_USERNAME]
      );
      console.log('✅ Admin password updated successfully!');
      console.log(`📝 User ID: ${existingAdmin.rows[0].id}`);
    } else {
      // Create new admin user
      console.log('👤 Creating new admin user...');
      const insertResult = await client.query(
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
    }
    
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };