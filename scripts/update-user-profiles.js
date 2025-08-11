#!/usr/bin/env node

/**
 * Update existing user profiles with data from Facebook Graph API
 * This script fetches and updates name and profile picture for all users
 */

const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false
  } : false
});

// Fetch user profile from Facebook Graph API
async function getUserProfile(userId) {
  try {
    console.log(`  Fetching profile for user ${userId}...`);
    
    const response = await axios.get(
      `${FACEBOOK_API_URL}/${userId}`,
      {
        params: {
          fields: 'first_name,last_name,profile_pic,locale,timezone',
          access_token: process.env.PAGE_ACCESS_TOKEN
        }
      }
    );
    
    const profileData = {
      name: `${response.data.first_name || ''} ${response.data.last_name || ''}`.trim() || 'User',
      first_name: response.data.first_name,
      last_name: response.data.last_name,
      profile_pic: response.data.profile_pic,
      locale: response.data.locale,
      timezone: response.data.timezone
    };
    
    console.log(`  ✅ Profile fetched: ${profileData.name}`);
    return profileData;
    
  } catch (error) {
    console.error(`  ❌ Error fetching profile for ${userId}:`, error.response?.data?.error?.message || error.message);
    return null;
  }
}

async function updateUserProfiles() {
  try {
    console.log('🔄 Starting user profile update...\n');
    
    // Check if PAGE_ACCESS_TOKEN is set
    if (!process.env.PAGE_ACCESS_TOKEN) {
      console.error('❌ PAGE_ACCESS_TOKEN not found in environment variables');
      console.log('Please set PAGE_ACCESS_TOKEN in your .env file');
      process.exit(1);
    }
    
    // Get all users from database
    console.log('📋 Fetching users from database...');
    const result = await pool.query(`
      SELECT id, name, profile_pic 
      FROM users 
      ORDER BY last_interaction DESC
    `);
    
    const users = result.rows;
    console.log(`Found ${users.length} users\n`);
    
    if (users.length === 0) {
      console.log('No users found in database');
      return;
    }
    
    // Process users
    let updated = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const user of users) {
      // Skip if user already has a real name and profile pic
      if (user.name && user.name !== 'User' && user.profile_pic) {
        console.log(`⏭️  Skipping ${user.id} - already has profile data (${user.name})`);
        skipped++;
        continue;
      }
      
      console.log(`\n🔍 Processing user ${user.id} (current name: ${user.name || 'none'})`);
      
      // Fetch profile from Facebook
      const profile = await getUserProfile(user.id);
      
      if (profile) {
        // Update user in database
        try {
          await pool.query(`
            UPDATE users 
            SET 
              name = $2,
              profile_pic = $3
            WHERE id = $1
          `, [user.id, profile.name, profile.profile_pic]);
          
          console.log(`  ✅ Updated user ${user.id} with name: ${profile.name}`);
          updated++;
        } catch (dbError) {
          console.error(`  ❌ Failed to update database for ${user.id}:`, dbError.message);
          failed++;
        }
      } else {
        failed++;
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('UPDATE COMPLETE');
    console.log('='.repeat(50));
    console.log(`✅ Updated: ${updated} users`);
    console.log(`⏭️  Skipped: ${skipped} users (already had data)`);
    console.log(`❌ Failed: ${failed} users`);
    console.log(`📊 Total: ${users.length} users`);
    
    // Show sample of updated users
    if (updated > 0) {
      console.log('\n📋 Sample of updated users:');
      const sampleResult = await pool.query(`
        SELECT id, name, profile_pic 
        FROM users 
        WHERE name != 'User' 
        AND profile_pic IS NOT NULL 
        ORDER BY last_interaction DESC 
        LIMIT 5
      `);
      
      sampleResult.rows.forEach(user => {
        console.log(`  • ${user.name} (${user.id})`);
        if (user.profile_pic) {
          console.log(`    Profile: ${user.profile_pic.substring(0, 50)}...`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the update
console.log('Facebook User Profile Updater');
console.log('==============================\n');

updateUserProfiles().then(() => {
  console.log('\n✅ Script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});