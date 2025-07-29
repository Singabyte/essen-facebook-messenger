require('dotenv').config();
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, process.env.DB_PATH || '../../database/bot.db');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create admin_users table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
)`, async (err) => {
  if (err) {
    console.error('Error creating table:', err);
    process.exit(1);
  }
  
  console.log('Admin users table ready');
  
  // Create admin user
  const username = 'admin';
  const password = 'hello123';
  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run(
    'INSERT INTO admin_users (username, password) VALUES (?, ?)',
    [username, hashedPassword],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          console.error('Admin user already exists!');
        } else {
          console.error('Error creating user:', err);
        }
      } else {
        console.log('✅ Admin user created successfully!');
        console.log('Username:', username);
        console.log('Password:', password);
        console.log('User ID:', this.lastID);
      }
      db.close();
    }
  );
});