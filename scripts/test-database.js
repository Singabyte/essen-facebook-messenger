require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    
    // Test connection
    const connectResult = await pool.query('SELECT NOW() as now');
    console.log('✓ Connected to database at:', connectResult.rows[0].now);
    
    // Check users table
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`✓ Users table has ${usersResult.rows[0].count} users`);
    
    // List some users
    const usersList = await pool.query('SELECT id, name, created_at, last_interaction FROM users LIMIT 5');
    console.log('\nFirst 5 users:');
    usersList.rows.forEach(user => {
      console.log(`  - ${user.id}: ${user.name} (last seen: ${user.last_interaction})`);
    });
    
    // Check conversations table
    const convsResult = await pool.query('SELECT COUNT(*) as count FROM conversations');
    console.log(`\n✓ Conversations table has ${convsResult.rows[0].count} conversations`);
    
    // List recent conversations
    const convsList = await pool.query(`
      SELECT c.user_id, u.name, c.message, c.timestamp 
      FROM conversations c 
      LEFT JOIN users u ON c.user_id = u.id 
      ORDER BY c.timestamp DESC 
      LIMIT 5
    `);
    console.log('\nRecent conversations:');
    convsList.rows.forEach(conv => {
      console.log(`  - ${conv.name || conv.user_id}: "${conv.message?.substring(0, 50)}..." at ${conv.timestamp}`);
    });
    
  } catch (error) {
    console.error('Database test failed:', error);
  } finally {
    await pool.end();
  }
}

testDatabase();