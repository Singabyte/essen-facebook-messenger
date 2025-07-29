#!/usr/bin/env node

// Simple debug script without external dependencies (except sqlite3 and bcryptjs)
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const https = require('https');

console.log('🔍 ESSEN Bot Production Debugging (Simple)\n');
console.log('==========================================\n');

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
    
    // Continue to recent messages check
    checkRecentMessages();
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
      checkRecentMessages();
    }
  );
}

async function resetAdminPassword(username) {
  const newPassword = 'hello123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  return new Promise((resolve) => {
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
        resolve();
      }
    );
  });
}

// Check Recent Messages
function checkRecentMessages() {
  console.log('\n4. RECENT MESSAGES CHECK:');
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
      
      // Check Facebook permissions if token exists
      if (process.env.PAGE_ACCESS_TOKEN) {
        checkFacebookPermissions();
      } else {
        showRecommendations();
      }
    }
  );
}

// Check Facebook permissions
function checkFacebookPermissions() {
  console.log('\n5. FACEBOOK PERMISSIONS CHECK:');
  console.log('-----------------------------');
  
  const token = process.env.PAGE_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.error) {
          console.error('❌ Facebook API error:', result.error.message);
          console.log('\n⚠️  Token might be expired or invalid');
        } else if (result.data) {
          console.log('✅ Current permissions:');
          result.data.forEach(perm => {
            console.log(`   - ${perm.permission}: ${perm.status}`);
          });
        }
      } catch (e) {
        console.error('❌ Error parsing Facebook response:', e.message);
      }
      showRecommendations();
    });
  }).on('error', (err) => {
    console.error('❌ Error checking Facebook permissions:', err.message);
    showRecommendations();
  });
}

function showRecommendations() {
  console.log('\n6. RECOMMENDATIONS:');
  console.log('------------------');
  
  const issues = [];
  
  if (!process.env.PAGE_ACCESS_TOKEN) {
    issues.push('Set PAGE_ACCESS_TOKEN environment variable');
  }
  if (!process.env.APP_SECRET) {
    issues.push('Set APP_SECRET environment variable (required for webhook signature)');
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
  }
  
  console.log('\n📌 IMPORTANT NOTES:');
  console.log('------------------');
  console.log('1. The Facebook error about pages_manage_metadata is OK - basic messaging still works');
  console.log('2. Make sure APP_SECRET is set from Facebook App Settings → Basic → App Secret');
  console.log('3. Webhook URL should be: https://essen-messenger-bot-zxxtw.ondigitalocean.app/webhook');
  console.log('4. In Facebook App, ensure webhook is subscribed to: messages, messaging_postbacks');
  console.log('5. Admin login: username=admin, password=hello123');
  
  console.log('\n✅ Debug complete!');
  db.close();
}