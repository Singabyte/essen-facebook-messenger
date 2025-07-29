const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = process.env.DB_PATH || '/workspace/database/bot.db';
console.log('Using database:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

// Check if admin_users table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'", (err, row) => {
  if (err) {
    console.error('Error checking table:', err);
    db.close();
    return;
  }
  
  if (!row) {
    console.log('❌ admin_users table does not exist!');
    db.close();
    return;
  }
  
  console.log('✅ admin_users table exists');
  
  // Get all admin users
  db.all('SELECT id, username, created_at, last_login FROM admin_users', async (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err);
    } else {
      console.log('\nAdmin users in database:');
      console.log('------------------------');
      rows.forEach(row => {
        console.log(`ID: ${row.id}, Username: ${row.username}, Created: ${row.created_at}, Last Login: ${row.last_login || 'Never'}`);
      });
      
      // Test password for first user
      if (rows.length > 0) {
        const testPassword = 'hello123';
        db.get('SELECT password FROM admin_users WHERE username = ?', [rows[0].username], async (err, user) => {
          if (err) {
            console.error('Error getting password:', err);
          } else if (user) {
            const isValid = await bcrypt.compare(testPassword, user.password);
            console.log(`\nPassword test for '${rows[0].username}' with 'hello123': ${isValid ? '✅ VALID' : '❌ INVALID'}`);
            
            // Show hash info
            console.log('Password hash starts with:', user.password.substring(0, 20) + '...');
          }
          db.close();
        });
      } else {
        db.close();
      }
    }
  });
});