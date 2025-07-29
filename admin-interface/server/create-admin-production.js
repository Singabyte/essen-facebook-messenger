#!/usr/bin/env node

require('dotenv').config();
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Get database path from environment or use default
const dbPath = path.resolve(process.env.DB_PATH || '/workspace/database/bot.db');
const dbDir = path.dirname(dbPath);

console.log('Database path:', dbPath);
console.log('Database directory:', dbDir);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  console.log('Creating database directory...');
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open database (will create if doesn't exist)
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Initialize all required tables for the bot (if needed)
const initTables = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    profile_pic TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  `CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    message TEXT,
    sender TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  
  `CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    preferences TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  
  `CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    user_id TEXT,
    data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  `CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    user_name TEXT,
    appointment_date DATE,
    appointment_time TEXT,
    phone TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  
  `CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )`
];

// Create all tables
let tablesCreated = 0;
initTables.forEach((sql, index) => {
  db.run(sql, (err) => {
    if (err) {
      console.error('Error creating table:', err);
      process.exit(1);
    }
    tablesCreated++;
    
    if (tablesCreated === initTables.length) {
      console.log('All tables initialized successfully');
      createAdminUser();
    }
  });
});

async function createAdminUser() {
  // Get username and password from environment or use defaults
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'hello123';
  
  if (!process.env.ADMIN_PASSWORD) {
    console.log('⚠️  Warning: Using default password. Set ADMIN_PASSWORD environment variable for production.');
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // First check if admin exists
  db.get('SELECT id FROM admin_users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('Error checking for existing admin:', err);
      db.close();
      return;
    }
    
    if (row) {
      console.log('Admin user already exists. Updating password...');
      db.run(
        'UPDATE admin_users SET password = ? WHERE username = ?',
        [hashedPassword, username],
        function(err) {
          if (err) {
            console.error('Error updating password:', err);
          } else {
            console.log('✅ Admin password updated successfully!');
            console.log('Username:', username);
            console.log('Password:', password);
          }
          db.close();
        }
      );
    } else {
      db.run(
        'INSERT INTO admin_users (username, password) VALUES (?, ?)',
        [username, hashedPassword],
        function(err) {
          if (err) {
            console.error('Error creating user:', err);
          } else {
            console.log('✅ Admin user created successfully!');
            console.log('Username:', username);
            console.log('Password:', password);
            console.log('User ID:', this.lastID);
          }
          db.close();
        }
      );
    }
  });
}