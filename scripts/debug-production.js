#!/usr/bin/env node

// Comprehensive debug script for production issues
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');

console.log('🔍 ESSEN Bot Production Debugging\n');
console.log('=================================\n');

// 1. Check Environment Variables
console.log('1. ENVIRONMENT VARIABLES CHECK:');
console.log('------------------------------');
const requiredEnvVars = [
  'PAGE_ACCESS_TOKEN',
  'VERIFY_TOKEN', 
  'APP_SECRET',
  'GEMINI_API_KEY',
  'DB_PATH'
];

requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    console.log(`✅ ${envVar}: Set (${value.substring(0, 10)}...)`);
  } else {
    console.log(`❌ ${envVar}: NOT SET`);
  }
});

// 2. Test Database Connection
console.log('\n2. DATABASE CONNECTION CHECK:');
console.log('-----------------------------');
const dbPath = path.resolve(process.env.DB_PATH || './database/bot.db');
console.log(`Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  } else {
    console.log('✅ Database connected successfully');
    checkDatabase();
  }
});

async function checkDatabase() {
  // Check tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('❌ Error checking tables:', err);
      return;
    }
    
    console.log('\nExisting tables:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    
    // Check admin users
    checkAdminUsers();
  });
}

function checkAdminUsers() {
  console.log('\n3. ADMIN USERS CHECK:');
  console.log('--------------------');
  
  db.all('SELECT id, username, created_at FROM admin_users', async (err, users) => {
    if (err) {
      console.error('❌ Error fetching admin users:', err.message);
      // Try to create the table
      createAdminTable();
      return;
    }
    
    if (users.length === 0) {
      console.log('❌ No admin users found');
      await createDefaultAdmin();
    } else {
      console.log(`✅ Found ${users.length} admin user(s):`);
      users.forEach(user => {
        console.log(`   - ${user.username} (ID: ${user.id})`);
      });
      
      // Reset first admin's password
      await resetAdminPassword(users[0].username);
    }
    
    // Continue to Facebook checks
    checkFacebookAPI();
  });
}

function createAdminTable() {
  console.log('Creating admin_users table...');
  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )`, (err) => {
    if (err) {
      console.error('❌ Failed to create admin_users table:', err);
    } else {
      console.log('✅ admin_users table created');
      createDefaultAdmin();
    }
  });
}

async function createDefaultAdmin() {
  const username = 'admin';
  const password = 'hello123';
  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run(
    'INSERT INTO admin_users (username, password) VALUES (?, ?)',
    [username, hashedPassword],
    function(err) {
      if (err) {
        console.error('❌ Error creating admin:', err.message);
      } else {
        console.log('✅ Admin user created:');
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}`);
      }
      checkFacebookAPI();
    }
  );
}

async function resetAdminPassword(username) {
  const newPassword = 'hello123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  db.run(
    'UPDATE admin_users SET password = ? WHERE username = ?',
    [hashedPassword, username],
    function(err) {
      if (err) {
        console.error('❌ Error resetting password:', err);
      } else {
        console.log(`✅ Password reset for '${username}'`);
        console.log(`   New password: ${newPassword}`);
      }
    }
  );
}

// 4. Test Facebook API
async function checkFacebookAPI() {
  console.log('\n4. FACEBOOK API CHECK:');
  console.log('---------------------');
  
  if (!process.env.PAGE_ACCESS_TOKEN) {
    console.log('❌ PAGE_ACCESS_TOKEN not set - skipping Facebook checks');
    checkWebhookEndpoint();
    return;
  }
  
  try {
    // Test token validity
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/me?access_token=${process.env.PAGE_ACCESS_TOKEN}`
    );
    
    console.log('✅ Facebook API token is valid');
    console.log(`   Page Name: ${response.data.name}`);
    console.log(`   Page ID: ${response.data.id}`);
    
    // Check webhook subscriptions
    const webhookResponse = await axios.get(
      `https://graph.facebook.com/v18.0/me/subscribed_apps?access_token=${process.env.PAGE_ACCESS_TOKEN}`
    );
    
    if (webhookResponse.data.data && webhookResponse.data.data.length > 0) {
      console.log('✅ Webhook subscriptions active');
    } else {
      console.log('❌ No webhook subscriptions found');
    }
    
  } catch (error) {
    console.error('❌ Facebook API error:', error.response?.data || error.message);
  }
  
  checkWebhookEndpoint();
}

// 5. Test Webhook Endpoint
async function checkWebhookEndpoint() {
  console.log('\n5. WEBHOOK ENDPOINT CHECK:');
  console.log('-------------------------');
  
  // Test local webhook
  try {
    const webhookUrl = `http://localhost:${process.env.PORT || 3000}/webhook`;
    const response = await axios.get(webhookUrl);
    console.log('✅ Local webhook endpoint is responding');
  } catch (error) {
    console.log('❌ Local webhook not accessible:', error.message);
  }
  
  // Test signature generation
  testWebhookSignature();
}

// 6. Test Webhook Signature
function testWebhookSignature() {
  console.log('\n6. WEBHOOK SIGNATURE CHECK:');
  console.log('--------------------------');
  
  if (!process.env.APP_SECRET) {
    console.log('❌ APP_SECRET not set - signature verification will fail');
  } else {
    const testBody = JSON.stringify({ test: 'data' });
    const signature = crypto
      .createHmac('sha1', process.env.APP_SECRET)
      .update(testBody)
      .digest('hex');
    
    console.log('✅ Signature generation working');
    console.log(`   Test signature: sha1=${signature}`);
  }
  
  // Check recent messages
  checkRecentMessages();
}

// 7. Check Recent Messages
function checkRecentMessages() {
  console.log('\n7. RECENT MESSAGES CHECK:');
  console.log('------------------------');
  
  db.all(
    'SELECT * FROM conversations ORDER BY timestamp DESC LIMIT 5',
    (err, messages) => {
      if (err) {
        console.error('❌ Error fetching messages:', err.message);
      } else if (messages.length === 0) {
        console.log('❌ No messages found in database');
      } else {
        console.log(`✅ Found ${messages.length} recent message(s)`);
        messages.forEach(msg => {
          console.log(`   - ${msg.sender}: ${msg.message.substring(0, 50)}... (${msg.timestamp})`);
        });
      }
      
      // Final recommendations
      showRecommendations();
    }
  );
}

function showRecommendations() {
  console.log('\n8. RECOMMENDATIONS:');
  console.log('------------------');
  
  const issues = [];
  
  if (!process.env.PAGE_ACCESS_TOKEN) {
    issues.push('Set PAGE_ACCESS_TOKEN environment variable');
  }
  if (!process.env.APP_SECRET) {
    issues.push('Set APP_SECRET environment variable');
  }
  if (!process.env.VERIFY_TOKEN) {
    issues.push('Set VERIFY_TOKEN environment variable');
  }
  if (!process.env.GEMINI_API_KEY) {
    issues.push('Set GEMINI_API_KEY environment variable');
  }
  
  if (issues.length > 0) {
    console.log('❌ Fix these issues:');
    issues.forEach(issue => {
      console.log(`   - ${issue}`);
    });
  } else {
    console.log('✅ All environment variables are set');
    console.log('\nIf messages still aren\'t working:');
    console.log('1. Check Facebook Developer Console webhook events');
    console.log('2. Ensure webhook URL is: https://essen-messenger-bot-zxxtw.ondigitalocean.app/webhook');
    console.log('3. Verify webhook is subscribed to: messages, messaging_postbacks');
    console.log('4. Check runtime logs for any errors when sending messages');
  }
  
  console.log('\n✅ Debug complete!');
  db.close();
}