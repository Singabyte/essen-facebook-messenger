#!/usr/bin/env node

/**
 * Get Instagram Business Account ID
 * This script helps you find your Instagram Business Account ID
 */

const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
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

async function findInstagramAccount() {
  try {
    log('\n🔍 Finding Instagram Business Account ID', 'magenta');
    log('=========================================', 'magenta');
    
    if (!PAGE_ACCESS_TOKEN) {
      log('\n❌ PAGE_ACCESS_TOKEN not found in .env file', 'red');
      log('   Please add your Page Access Token to continue', 'yellow');
      process.exit(1);
    }
    
    // Get all pages
    log('\n📄 Fetching Facebook Pages...', 'blue');
    const pagesResponse = await axios.get(`${GRAPH_API_URL}/me/accounts`, {
      params: {
        access_token: PAGE_ACCESS_TOKEN,
        fields: 'id,name,instagram_business_account,access_token'
      }
    });
    
    const pages = pagesResponse.data.data;
    
    if (!pages || pages.length === 0) {
      log('❌ No Facebook Pages found', 'red');
      log('   Make sure your access token has the correct permissions', 'yellow');
      process.exit(1);
    }
    
    log(`✅ Found ${pages.length} Facebook Page(s)`, 'green');
    
    let foundInstagram = false;
    
    for (const page of pages) {
      log(`\n📘 Page: ${page.name}`, 'cyan');
      log(`   Page ID: ${page.id}`, 'yellow');
      
      if (page.instagram_business_account) {
        foundInstagram = true;
        const igId = page.instagram_business_account.id;
        
        // Get Instagram account details
        try {
          const igResponse = await axios.get(`${GRAPH_API_URL}/${igId}`, {
            params: {
              access_token: page.access_token || PAGE_ACCESS_TOKEN,
              fields: 'id,username,name,followers_count,media_count,profile_picture_url,ig_id'
            }
          });
          
          const igAccount = igResponse.data;
          
          log('\n   ✅ Instagram Business Account Connected:', 'green');
          log(`      Instagram Business Account ID: ${igAccount.id}`, 'magenta');
          log(`      Username: @${igAccount.username}`, 'yellow');
          log(`      Name: ${igAccount.name || 'N/A'}`, 'yellow');
          log(`      Followers: ${igAccount.followers_count || 'N/A'}`, 'yellow');
          log(`      Posts: ${igAccount.media_count || 'N/A'}`, 'yellow');
          if (igAccount.ig_id) {
            log(`      Instagram User ID: ${igAccount.ig_id}`, 'yellow');
          }
          
          log('\n   📝 Add this to your .env file:', 'blue');
          log(`      INSTAGRAM_BUSINESS_ACCOUNT_ID=${igAccount.id}`, 'green');
          
        } catch (error) {
          log(`   ⚠️  Instagram account found but couldn't get details: ${error.message}`, 'yellow');
          log(`      Instagram Business Account ID: ${igId}`, 'magenta');
          log('\n   📝 Add this to your .env file:', 'blue');
          log(`      INSTAGRAM_BUSINESS_ACCOUNT_ID=${igId}`, 'green');
        }
      } else {
        log('   ❌ No Instagram account connected to this page', 'red');
      }
    }
    
    if (!foundInstagram) {
      log('\n❌ No Instagram Business Account found', 'red');
      log('\n📝 To connect Instagram to your Facebook Page:', 'blue');
      log('   1. Go to Meta Business Suite (business.facebook.com)', 'yellow');
      log('   2. Navigate to Settings > Accounts > Instagram accounts', 'yellow');
      log('   3. Click "Connect" and follow the instructions', 'yellow');
      log('   4. Make sure your Instagram account is a Business or Creator account', 'yellow');
    } else {
      log('\n✅ Instagram Business Account ID found!', 'green');
      log('\n📝 Important Notes:', 'blue');
      log('   - INSTAGRAM_ID in your .env should be the Instagram Business Account ID (17-18 digits)', 'yellow');
      log('   - Not the App ID (16 digits) or Instagram User ID', 'yellow');
      log('   - Update your .env file with INSTAGRAM_BUSINESS_ACCOUNT_ID value shown above', 'yellow');
    }
    
  } catch (error) {
    log(`\n❌ Error: ${error.response?.data?.error?.message || error.message}`, 'red');
    
    if (error.response?.status === 400) {
      log('\n💡 This might be a token permission issue. Make sure your token has:', 'yellow');
      log('   - pages_show_list', 'yellow');
      log('   - instagram_basic', 'yellow');
      log('   - instagram_manage_messages', 'yellow');
    }
  }
}

// Run the script
findInstagramAccount().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});