#!/usr/bin/env node

/**
 * Simple Instagram webhook subscription
 * Directly subscribes the Instagram account using the Page Access Token
 */

const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '67126555778';
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
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n🚀 Simple Instagram Webhook Subscription', 'magenta');
  log('=========================================', 'magenta');
  
  if (!PAGE_ACCESS_TOKEN) {
    log('\n❌ PAGE_ACCESS_TOKEN not found in .env', 'red');
    process.exit(1);
  }
  
  log('\n📋 Configuration:', 'blue');
  log(`  Instagram Business Account ID: ${INSTAGRAM_BUSINESS_ACCOUNT_ID}`, 'yellow');
  log(`  Access Token: ✅ Set`, 'yellow');
  
  try {
    // Method 1: Subscribe directly using Instagram account ID
    log('\n📝 Method 1: Direct subscription to Instagram account...', 'blue');
    try {
      const response = await axios.post(
        `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/subscribed_apps`,
        {},
        {
          params: {
            access_token: PAGE_ACCESS_TOKEN,
            subscribed_fields: 'messages,messaging_postbacks,messaging_seen'
          }
        }
      );
      
      log('✅ Successfully subscribed!', 'green');
      log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'yellow');
    } catch (error) {
      log(`⚠️  Direct method failed: ${error.response?.data?.error?.message}`, 'yellow');
      
      // Method 2: Try using me/subscribed_apps endpoint
      log('\n📝 Method 2: Using Page subscription endpoint...', 'blue');
      try {
        const response = await axios.post(
          `${GRAPH_API_URL}/me/subscribed_apps`,
          {},
          {
            params: {
              access_token: PAGE_ACCESS_TOKEN,
              subscribed_fields: 'messages,messaging_postbacks,messaging_seen,feed'
            }
          }
        );
        
        log('✅ Page subscription successful!', 'green');
        log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'yellow');
      } catch (error2) {
        log(`❌ Page method also failed: ${error2.response?.data?.error?.message}`, 'red');
      }
    }
    
    // Check current subscriptions
    log('\n📋 Checking current subscriptions...', 'blue');
    
    // Try to get Page info first
    try {
      const pageResponse = await axios.get(`${GRAPH_API_URL}/me`, {
        params: {
          access_token: PAGE_ACCESS_TOKEN,
          fields: 'id,name,instagram_business_account'
        }
      });
      
      log(`\n📘 Page Info:`, 'cyan');
      log(`  Page ID: ${pageResponse.data.id}`, 'yellow');
      log(`  Page Name: ${pageResponse.data.name}`, 'yellow');
      
      if (pageResponse.data.instagram_business_account) {
        const igId = pageResponse.data.instagram_business_account.id;
        log(`  Connected Instagram ID: ${igId}`, 'green');
        
        // Try to subscribe using the detected Instagram ID
        if (igId && igId !== INSTAGRAM_BUSINESS_ACCOUNT_ID) {
          log(`\n⚠️  Note: Detected Instagram ID (${igId}) differs from configured (${INSTAGRAM_BUSINESS_ACCOUNT_ID})`, 'yellow');
          log('   Trying to subscribe detected account...', 'yellow');
          
          try {
            const response = await axios.post(
              `${GRAPH_API_URL}/${igId}/subscribed_apps`,
              {},
              {
                params: {
                  access_token: PAGE_ACCESS_TOKEN,
                  subscribed_fields: 'messages,messaging_postbacks,messaging_seen'
                }
              }
            );
            
            log('✅ Successfully subscribed detected Instagram account!', 'green');
            log(`\n📝 Update your .env file:`, 'blue');
            log(`   INSTAGRAM_BUSINESS_ACCOUNT_ID=${igId}`, 'green');
          } catch (error) {
            log(`⚠️  Could not subscribe detected account: ${error.response?.data?.error?.message}`, 'yellow');
          }
        }
      } else {
        log('  No Instagram account connected to this page', 'red');
      }
    } catch (error) {
      log(`⚠️  Could not get page info: ${error.response?.data?.error?.message}`, 'yellow');
    }
    
    // Try to list subscribed apps
    try {
      const response = await axios.get(`${GRAPH_API_URL}/me/subscribed_apps`, {
        params: {
          access_token: PAGE_ACCESS_TOKEN
        }
      });
      
      if (response.data.data && response.data.data.length > 0) {
        log('\n✅ Current app subscriptions:', 'green');
        response.data.data.forEach(app => {
          log(`  App ID: ${app.id}`, 'yellow');
          if (app.subscribed_fields) {
            log(`  Fields: ${app.subscribed_fields.join(', ')}`, 'yellow');
          }
        });
      }
    } catch (error) {
      log(`⚠️  Could not list subscriptions: ${error.response?.data?.error?.message}`, 'yellow');
    }
    
    log('\n📱 Next Steps:', 'magenta');
    log('1. Send a message to your Instagram business account', 'yellow');
    log('2. Check server logs for webhook events', 'yellow');
    log('3. Visit /debug/webhooks to see captured events', 'yellow');
    
  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    if (error.response?.data) {
      console.error('Full error:', error.response.data);
    }
  }
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});