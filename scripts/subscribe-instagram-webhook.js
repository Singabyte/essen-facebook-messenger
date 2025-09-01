#!/usr/bin/env node

/**
 * Subscribe Instagram account to webhooks
 * This script subscribes your Instagram account to receive webhook events
 */

const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID; // This should be Instagram Business Account ID, not App ID
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_ID; // This is the App ID (for backward compatibility)
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || PAGE_ACCESS_TOKEN;
const APP_ID = process.env.APP_ID || process.env.FACEBOOK_APP_ID || INSTAGRAM_APP_ID;

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

// Check if Instagram account is connected to the page
async function checkInstagramConnection() {
  try {
    log('\n🔍 Checking Instagram account connection...', 'blue');
    
    const response = await axios.get(`${GRAPH_API_URL}/me/accounts`, {
      params: {
        access_token: PAGE_ACCESS_TOKEN,
        fields: 'id,name,instagram_business_account'
      }
    });
    
    const pages = response.data.data;
    log(`Found ${pages.length} page(s)`, 'yellow');
    
    for (const page of pages) {
      if (page.instagram_business_account) {
        log(`✅ Page "${page.name}" has Instagram account: ${page.instagram_business_account.id}`, 'green');
        return page.instagram_business_account.id;
      }
    }
    
    log('❌ No Instagram business account found connected to your pages', 'red');
    log('Please connect your Instagram account to your Facebook Page in Meta Business Suite', 'yellow');
    return null;
    
  } catch (error) {
    log(`❌ Error checking Instagram connection: ${error.response?.data?.error?.message || error.message}`, 'red');
    return null;
  }
}

// Subscribe app to Instagram webhooks
async function subscribeToInstagramWebhooks(instagramAccountId) {
  try {
    log('\n📝 Subscribing to Instagram webhooks...', 'blue');
    
    // Subscribe to the Instagram account
    const response = await axios.post(
      `${GRAPH_API_URL}/${instagramAccountId}/subscribed_apps`,
      {
        subscribed_fields: 'messages,messaging_postbacks,messaging_seen'
      },
      {
        params: {
          access_token: INSTAGRAM_ACCESS_TOKEN
        }
      }
    );
    
    log('✅ Successfully subscribed to Instagram webhooks', 'green');
    log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'yellow');
    
    return true;
    
  } catch (error) {
    log(`❌ Error subscribing to webhooks: ${error.response?.data?.error?.message || error.message}`, 'red');
    
    if (error.response?.data?.error?.code === 100) {
      log('\n💡 Tip: Make sure your app has the required permissions:', 'yellow');
      log('  - instagram_basic', 'yellow');
      log('  - instagram_manage_messages', 'yellow');
      log('  - pages_manage_metadata', 'yellow');
      log('  - pages_messaging', 'yellow');
    }
    
    return false;
  }
}

// Get current webhook subscriptions
async function getCurrentSubscriptions(instagramAccountId) {
  try {
    log('\n📋 Getting current webhook subscriptions...', 'blue');
    
    const response = await axios.get(
      `${GRAPH_API_URL}/${instagramAccountId}/subscribed_apps`,
      {
        params: {
          access_token: INSTAGRAM_ACCESS_TOKEN
        }
      }
    );
    
    if (response.data.data && response.data.data.length > 0) {
      log('✅ Current subscriptions:', 'green');
      response.data.data.forEach(sub => {
        log(`  - App ID: ${sub.id}`, 'yellow');
        log(`    Fields: ${sub.subscribed_fields?.join(', ') || 'none'}`, 'yellow');
      });
    } else {
      log('ℹ️ No current webhook subscriptions found', 'yellow');
    }
    
    return response.data.data;
    
  } catch (error) {
    log(`❌ Error getting subscriptions: ${error.response?.data?.error?.message || error.message}`, 'red');
    return [];
  }
}

// Test webhook by sending a test message
async function sendTestMessage(instagramAccountId) {
  try {
    log('\n🧪 Sending test message...', 'blue');
    
    // Note: This requires the Instagram account to have messaged the page first
    log('⚠️ Note: Test messages can only be sent to users who have messaged you first', 'yellow');
    
    // You can't directly send a test message to yourself
    // Instead, we'll verify the webhook URL
    const webhookUrl = process.env.WEBHOOK_URL || 'https://essen-messenger-bot-zxxtw.ondigitalocean.app/webhook';
    log(`Webhook URL: ${webhookUrl}`, 'yellow');
    
    log('\n📱 To test:', 'magenta');
    log('1. Open Instagram app', 'yellow');
    log('2. Send a message to your business account', 'yellow');
    log('3. Check your server logs for webhook events', 'yellow');
    log('4. Visit /debug/webhooks endpoint to see captured events', 'yellow');
    
    return true;
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// Main function
async function main() {
  log('\n🚀 Instagram Webhook Subscription Tool', 'magenta');
  log('=====================================', 'magenta');
  
  // Check configuration
  if (!PAGE_ACCESS_TOKEN) {
    log('\n❌ Missing required configuration:', 'red');
    log('Please set the following in your .env file:', 'yellow');
    log('  - PAGE_ACCESS_TOKEN (required)', 'yellow');
    log('  - INSTAGRAM_BUSINESS_ACCOUNT_ID (optional, will auto-detect)', 'yellow');
    log('  - INSTAGRAM_ACCESS_TOKEN (optional, will use PAGE_ACCESS_TOKEN)', 'yellow');
    process.exit(1);
  }
  
  log('\n📋 Configuration:', 'blue');
  log(`  App ID: ${APP_ID || INSTAGRAM_APP_ID || 'Not set'}`, 'yellow');
  log(`  Instagram Business Account ID: ${INSTAGRAM_BUSINESS_ACCOUNT_ID || 'Not set (will auto-detect)'}`, 'yellow');
  log(`  Access Token: ${INSTAGRAM_ACCESS_TOKEN ? '✅ Set' : 'Using PAGE_ACCESS_TOKEN'}`, 'yellow');
  
  if (INSTAGRAM_APP_ID && !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    log('\n⚠️  Warning: INSTAGRAM_ID appears to be an App ID, not an Instagram Business Account ID', 'yellow');
    log('  App IDs are typically 16 digits, Instagram account IDs are typically 17-18 digits', 'yellow');
    log('  Will auto-detect the correct Instagram Business Account ID...', 'yellow');
  }
  
  // Check Instagram connection - always check even if ID is provided to verify it's correct
  const detectedAccountId = await checkInstagramConnection();
  const instagramAccountId = INSTAGRAM_BUSINESS_ACCOUNT_ID || detectedAccountId;
  
  if (!instagramAccountId) {
    log('\n❌ Could not find Instagram account ID', 'red');
    process.exit(1);
  }
  
  log(`\n✅ Using Instagram Account ID: ${instagramAccountId}`, 'green');
  
  // Get current subscriptions
  await getCurrentSubscriptions(instagramAccountId);
  
  // Subscribe to webhooks
  const subscribed = await subscribeToInstagramWebhooks(instagramAccountId);
  
  if (subscribed) {
    // Verify subscription
    await getCurrentSubscriptions(instagramAccountId);
    
    // Provide testing instructions
    await sendTestMessage(instagramAccountId);
    
    log('\n✅ Setup complete!', 'green');
    log('\n🔍 Debug URLs:', 'blue');
    log(`  View webhooks: ${process.env.WEBHOOK_URL?.replace('/webhook', '/debug/webhooks') || 'http://localhost:3000/debug/webhooks'}`, 'yellow');
    log(`  Health check: ${process.env.WEBHOOK_URL?.replace('/webhook', '/health') || 'http://localhost:3000/health'}`, 'yellow');
  } else {
    log('\n❌ Setup failed. Please check the errors above.', 'red');
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});