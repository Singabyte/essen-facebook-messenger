#!/usr/bin/env node

/**
 * Debug Instagram connection and find the correct Instagram Business Account ID
 */

const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function debugInstagramConnection() {
  log('\n🔍 Debugging Instagram Connection', 'magenta');
  log('===================================', 'magenta');
  
  if (!PAGE_ACCESS_TOKEN) {
    log('\n❌ PAGE_ACCESS_TOKEN not found in .env', 'red');
    process.exit(1);
  }
  
  try {
    // Test 1: Get Page info directly
    log('\n📘 Test 1: Getting Page info with me endpoint...', 'blue');
    try {
      const response = await axios.get(`${GRAPH_API_URL}/me`, {
        params: {
          access_token: PAGE_ACCESS_TOKEN,
          fields: 'id,name,instagram_business_account,connected_instagram_account,instagram_accounts'
        }
      });
      
      log('Page Info:', 'green');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      log(`❌ Error: ${error.response?.data?.error?.message}`, 'red');
    }
    
    // Test 2: Get Page by ID
    log('\n📘 Test 2: Getting Page by ID (378284972025255)...', 'blue');
    try {
      const response = await axios.get(`${GRAPH_API_URL}/378284972025255`, {
        params: {
          access_token: PAGE_ACCESS_TOKEN,
          fields: 'id,name,instagram_business_account,connected_instagram_account'
        }
      });
      
      log('Page Info by ID:', 'green');
      console.log(JSON.stringify(response.data, null, 2));
      
      if (response.data.instagram_business_account) {
        const igId = response.data.instagram_business_account.id;
        log(`\n✅ Instagram Business Account ID found: ${igId}`, 'green');
        
        // Try to get Instagram account details
        log('\n📸 Getting Instagram account details...', 'blue');
        try {
          const igResponse = await axios.get(`${GRAPH_API_URL}/${igId}`, {
            params: {
              access_token: PAGE_ACCESS_TOKEN,
              fields: 'id,username,name,biography,website,followers_count,media_count'
            }
          });
          
          log('Instagram Account Details:', 'green');
          console.log(JSON.stringify(igResponse.data, null, 2));
        } catch (igError) {
          log(`⚠️  Could not get Instagram details: ${igError.response?.data?.error?.message}`, 'yellow');
        }
      }
    } catch (error) {
      log(`❌ Error: ${error.response?.data?.error?.message}`, 'red');
    }
    
    // Test 3: Try to find Instagram account through different endpoint
    log('\n📘 Test 3: Checking Page Instagram accounts...', 'blue');
    try {
      const response = await axios.get(`${GRAPH_API_URL}/378284972025255/instagram_accounts`, {
        params: {
          access_token: PAGE_ACCESS_TOKEN
        }
      });
      
      log('Instagram Accounts:', 'green');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      log(`⚠️  Error: ${error.response?.data?.error?.message}`, 'yellow');
    }
    
    // Test 4: Check token permissions
    log('\n🔐 Test 4: Checking token permissions...', 'blue');
    try {
      const response = await axios.get(`${GRAPH_API_URL}/debug_token`, {
        params: {
          input_token: PAGE_ACCESS_TOKEN,
          access_token: PAGE_ACCESS_TOKEN
        }
      });
      
      if (response.data.data) {
        const tokenData = response.data.data;
        log('Token Info:', 'green');
        log(`  Type: ${tokenData.type}`, 'yellow');
        log(`  App ID: ${tokenData.app_id}`, 'yellow');
        log(`  User ID: ${tokenData.user_id || 'N/A'}`, 'yellow');
        
        if (tokenData.scopes) {
          log('  Permissions:', 'yellow');
          tokenData.scopes.forEach(scope => {
            const isImportant = ['instagram_basic', 'instagram_manage_messages', 'pages_messaging'].includes(scope);
            log(`    ${isImportant ? '✅' : '  '} ${scope}`, isImportant ? 'green' : 'cyan');
          });
        }
        
        if (tokenData.granular_scopes) {
          log('  Granular Scopes:', 'yellow');
          Object.entries(tokenData.granular_scopes).forEach(([key, value]) => {
            log(`    ${key}: ${JSON.stringify(value)}`, 'cyan');
          });
        }
      }
    } catch (error) {
      log(`⚠️  Could not check token: ${error.response?.data?.error?.message}`, 'yellow');
    }
    
    // Test 5: Try Instagram Graph API directly
    log('\n📘 Test 5: Trying Instagram Graph API with known ID...', 'blue');
    const knownInstagramId = '67126555778'; // Your Instagram Business Account ID
    try {
      const response = await axios.get(`${GRAPH_API_URL}/${knownInstagramId}`, {
        params: {
          access_token: PAGE_ACCESS_TOKEN,
          fields: 'id,username,name'
        }
      });
      
      log('Instagram Account via direct ID:', 'green');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      log(`⚠️  Error: ${error.response?.data?.error?.message}`, 'yellow');
    }
    
    // Test 6: Subscribe apps endpoint
    log('\n📘 Test 6: Checking subscribed apps...', 'blue');
    try {
      const response = await axios.get(`${GRAPH_API_URL}/378284972025255/subscribed_apps`, {
        params: {
          access_token: PAGE_ACCESS_TOKEN
        }
      });
      
      log('Subscribed Apps:', 'green');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      log(`⚠️  Error: ${error.response?.data?.error?.message}`, 'yellow');
    }
    
    log('\n📊 Summary:', 'magenta');
    log('===========', 'magenta');
    log('1. Check if Instagram account ID appears in any of the tests above', 'yellow');
    log('2. If found, update INSTAGRAM_BUSINESS_ACCOUNT_ID in .env', 'yellow');
    log('3. Make sure token has instagram_basic and instagram_manage_messages permissions', 'yellow');
    log('4. You may need to regenerate your Page Access Token with Instagram permissions', 'yellow');
    
  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
  }
}

debugInstagramConnection().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});