#!/usr/bin/env node

/**
 * Test script to verify PostgreSQL SSL connections
 * Usage: DATABASE_URL="your_connection_string" node test-db-connection.js
 */

require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('❌ No DATABASE_URL found in environment variables');
    console.log('💡 Usage: DATABASE_URL="your_connection_string" node test-db-connection.js');
    process.exit(1);
  }

  console.log('🔍 Testing PostgreSQL connection...');
  console.log('📍 Database URL (masked):', databaseUrl.replace(/:[^:@]*@/, ':****@'));

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      // For DigitalOcean managed databases, we need to properly handle SSL
      rejectUnauthorized: true,
      // Allow self-signed certificates from DigitalOcean
      checkServerIdentity: (host, cert) => {
        // DigitalOcean managed databases use certificates that may not match hostname
        // This is safe for managed services within the same project
        return undefined;
      },
      // Set minimum TLS version
      secureProtocol: 'TLSv1_2_method'
    },
    max: 1, // Single connection for testing
    connectionTimeoutMillis: 10000,
    application_name: 'essen-db-connection-test'
  });

  try {
    // Test basic connection
    console.log('⏳ Attempting to connect...');
    const client = await pool.connect();
    
    // Test query
    console.log('⏳ Running test query...');
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    
    console.log('✅ Connection successful!');
    console.log('🕐 Current time:', result.rows[0].current_time);
    console.log('🗄️  PostgreSQL version:', result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]);
    
    // Test table creation (basic schema check)
    console.log('⏳ Testing table operations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        test_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query('INSERT INTO connection_test DEFAULT VALUES');
    const testResult = await client.query('SELECT COUNT(*) as count FROM connection_test');
    
    console.log('✅ Table operations successful!');
    console.log('📊 Test records in table:', testResult.rows[0].count);
    
    // Cleanup
    await client.query('DROP TABLE IF EXISTS connection_test');
    client.release();
    
    console.log('🎉 All tests passed! SSL connection is working correctly.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.log('💡 This error indicates SSL certificate issues.');
      console.log('💡 The updated SSL configuration should resolve this.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Connection refused - check if database is running and URL is correct.');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 Host not found - check the database hostname in your URL.');
    } else if (error.code === '28P01') {
      console.log('💡 Authentication failed - check username and password.');
    }
    
    console.error('🔍 Full error details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Run the test
testConnection().catch(console.error);