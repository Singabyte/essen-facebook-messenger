#!/usr/bin/env node

/**
 * Migration script from SQLite to PostgreSQL
 * This script copies all data from SQLite database to PostgreSQL
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Configuration
const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, '../database/bot.db');
const postgresUrl = process.env.DATABASE_URL;

if (!postgresUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

// SQLite connection
const sqlite = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database:', sqlitePath);
});

// PostgreSQL connection
const pg = new Pool({
  connectionString: postgresUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  try {
    console.log('Starting migration from SQLite to PostgreSQL...\n');

    // Test PostgreSQL connection
    await pg.query('SELECT NOW()');
    console.log('Connected to PostgreSQL database');

    // Initialize PostgreSQL schema
    console.log('\n1. Creating PostgreSQL tables...');
    const { initDatabase } = require('../src/database-pg');
    await initDatabase();

    // Migrate users
    console.log('\n2. Migrating users...');
    const users = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM users', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const user of users) {
      await pg.query(
        `INSERT INTO users (id, name, profile_pic, created_at, last_interaction)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.name, user.profile_pic, user.created_at, user.last_interaction]
      );
    }
    console.log(`   Migrated ${users.length} users`);

    // Migrate conversations
    console.log('\n3. Migrating conversations...');
    const conversations = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM conversations ORDER BY timestamp', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const conv of conversations) {
      await pg.query(
        `INSERT INTO conversations (user_id, message, response, timestamp)
         VALUES ($1, $2, $3, $4)`,
        [conv.user_id, conv.message, conv.response, conv.timestamp]
      );
    }
    console.log(`   Migrated ${conversations.length} conversations`);

    // Migrate user_preferences
    console.log('\n4. Migrating user preferences...');
    const preferences = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM user_preferences', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const pref of preferences) {
      await pg.query(
        `INSERT INTO user_preferences (user_id, preferences, created_at, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO NOTHING`,
        [pref.user_id, pref.preferences, pref.created_at, pref.updated_at]
      );
    }
    console.log(`   Migrated ${preferences.length} user preferences`);

    // Migrate analytics
    console.log('\n5. Migrating analytics...');
    const analytics = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM analytics ORDER BY timestamp', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const event of analytics) {
      await pg.query(
        `INSERT INTO analytics (event_type, user_id, data, timestamp)
         VALUES ($1, $2, $3, $4)`,
        [event.event_type, event.user_id, event.data, event.timestamp]
      );
    }
    console.log(`   Migrated ${analytics.length} analytics events`);

    // Migrate appointments
    console.log('\n6. Migrating appointments...');
    const appointments = await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM appointments', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const apt of appointments) {
      await pg.query(
        `INSERT INTO appointments (user_id, appointment_date, appointment_time, name, phone, email, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [apt.user_id, apt.appointment_date, apt.appointment_time, apt.name, apt.phone, apt.email, apt.message, apt.created_at]
      );
    }
    console.log(`   Migrated ${appointments.length} appointments`);

    // Migrate admin_users if they exist
    console.log('\n7. Migrating admin users...');
    try {
      const adminUsers = await new Promise((resolve, reject) => {
        sqlite.all('SELECT * FROM admin_users', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      for (const admin of adminUsers) {
        await pg.query(
          `INSERT INTO admin_users (username, password, created_at, last_login)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (username) DO NOTHING`,
          [admin.username, admin.password, admin.created_at, admin.last_login]
        );
      }
      console.log(`   Migrated ${adminUsers.length} admin users`);
    } catch (err) {
      console.log('   No admin users table found in SQLite database');
    }

    console.log('\n✅ Migration completed successfully!');
    
    // Close connections
    sqlite.close();
    await pg.end();
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    sqlite.close();
    await pg.end();
    process.exit(1);
  }
}

// Run migration
migrate();