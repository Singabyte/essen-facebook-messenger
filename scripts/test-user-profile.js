#!/usr/bin/env node

/**
 * Test script to verify user profile fetching from Facebook API
 */

const axios = require('axios');
require('dotenv').config();

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

async function testUserProfile(userId) {
  console.log(`\n🔍 Testing profile fetch for user ID: ${userId}`);
  console.log('=' . repeat(50));
  
  try {
    // Make the API call
    console.log('\n📡 Making API call to Facebook...');
    console.log(`URL: ${FACEBOOK_API_URL}/${userId}`);
    console.log('Fields: first_name, last_name, profile_pic, locale, timezone');
    
    const response = await axios.get(
      `${FACEBOOK_API_URL}/${userId}`,
      {
        params: {
          fields: 'first_name,last_name,profile_pic,locale,timezone',
          access_token: process.env.PAGE_ACCESS_TOKEN
        }
      }
    );
    
    console.log('\n✅ API call successful!');
    console.log('\n📋 Profile Data:');
    console.log('----------------');
    console.log(`First Name: ${response.data.first_name || 'Not available'}`);
    console.log(`Last Name: ${response.data.last_name || 'Not available'}`);
    console.log(`Full Name: ${`${response.data.first_name || ''} ${response.data.last_name || ''}`.trim() || 'User'}`);
    console.log(`Profile Picture: ${response.data.profile_pic ? 'Available' : 'Not available'}`);
    if (response.data.profile_pic) {
      console.log(`  URL: ${response.data.profile_pic.substring(0, 80)}...`);
    }
    console.log(`Locale: ${response.data.locale || 'Not available'}`);
    console.log(`Timezone: ${response.data.timezone || 'Not available'}`);
    
    console.log('\n📦 Raw Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return true;
    
  } catch (error) {
    console.error('\n❌ API call failed!');
    
    if (error.response) {
      console.error('\n📛 Error Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data?.error) {
        const fbError = error.response.data.error;
        console.error('\n🔍 Facebook Error Details:');
        console.error(`Message: ${fbError.message}`);
        console.error(`Type: ${fbError.type}`);
        console.error(`Code: ${fbError.code}`);
        console.error(`Subcode: ${fbError.error_subcode}`);
        
        // Provide helpful suggestions
        console.log('\n💡 Possible Solutions:');
        
        if (fbError.code === 190) {
          console.log('• Check if PAGE_ACCESS_TOKEN is valid and not expired');
          console.log('• Regenerate token from Facebook App Dashboard');
        } else if (fbError.code === 100) {
          console.log('• User ID might be invalid or user has blocked the app');
          console.log('• Check if the user ID is correct');
        } else if (fbError.message?.includes('permissions')) {
          console.log('• Your app might need additional permissions');
          console.log('• Check Facebook App Review status');
        }
      }
    } else {
      console.error('Error:', error.message);
    }
    
    return false;
  }
}

async function main() {
  console.log('Facebook User Profile Test');
  console.log('===========================');
  
  // Check environment
  if (!process.env.PAGE_ACCESS_TOKEN) {
    console.error('\n❌ PAGE_ACCESS_TOKEN not found in environment variables');
    console.log('Please set PAGE_ACCESS_TOKEN in your .env file');
    process.exit(1);
  }
  
  console.log('\n✅ PAGE_ACCESS_TOKEN found');
  console.log(`Token preview: ${process.env.PAGE_ACCESS_TOKEN.substring(0, 20)}...`);
  
  // Get user ID from command line or use a default test
  const userId = process.argv[2];
  
  if (!userId) {
    console.log('\n📝 Usage: node test-user-profile.js <USER_ID>');
    console.log('Example: node test-user-profile.js 9496392340415454');
    console.log('\n💡 Tip: You can find user IDs in your database or from webhook logs');
    
    // Try to get a sample user from database
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL ? {
        rejectUnauthorized: false
      } : false
    });
    
    try {
      console.log('\n🔍 Looking for a sample user in database...');
      const result = await pool.query('SELECT id, name FROM users LIMIT 1');
      
      if (result.rows.length > 0) {
        const sampleUser = result.rows[0];
        console.log(`\nFound user: ${sampleUser.name} (${sampleUser.id})`);
        console.log(`\n📌 Try running: node test-user-profile.js ${sampleUser.id}`);
      }
    } catch (dbError) {
      console.log('Could not fetch sample user from database');
    } finally {
      await pool.end();
    }
    
    process.exit(0);
  }
  
  // Test the profile fetch
  const success = await testUserProfile(userId);
  
  if (success) {
    console.log('\n✅ Test completed successfully!');
    console.log('The user profile fetching is working correctly.');
  } else {
    console.log('\n❌ Test failed!');
    console.log('Please check the error messages above and fix any issues.');
  }
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});