#!/usr/bin/env node

/**
 * Verify Instagram webhook configuration and status
 * This script checks if Instagram webhooks are properly configured
 */

const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const INSTAGRAM_ID = process.env.INSTAGRAM_ID;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || PAGE_ACCESS_TOKEN;
const APP_ID = process.env.APP_ID || process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.APP_SECRET;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://essen-messenger-bot-zxxtw.ondigitalocean.app/webhook';

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

// Check environment variables
function checkEnvironment() {
  log('\n🔧 Environment Configuration', 'cyan');
  log('==============================', 'cyan');
  
  const configs = [
    { name: 'INSTAGRAM_ID', value: INSTAGRAM_ID, required: false },
    { name: 'INSTAGRAM_ACCESS_TOKEN', value: INSTAGRAM_ACCESS_TOKEN, required: false },
    { name: 'PAGE_ACCESS_TOKEN', value: PAGE_ACCESS_TOKEN, required: true },
    { name: 'APP_SECRET', value: APP_SECRET, required: true },
    { name: 'APP_ID', value: APP_ID, required: false },
    { name: 'WEBHOOK_URL', value: WEBHOOK_URL, required: false }
  ];
  
  let allRequired = true;
  
  configs.forEach(config => {
    if (config.value) {
      log(`✅ ${config.name}: ${config.name.includes('SECRET') || config.name.includes('TOKEN') ? '***' : config.value}`, 'green');
    } else if (config.required) {
      log(`❌ ${config.name}: Not set (REQUIRED)`, 'red');
      allRequired = false;
    } else {
      log(`⚠️  ${config.name}: Not set (optional)`, 'yellow');
    }
  });
  
  return allRequired;
}

// Get Instagram account details
async function getInstagramAccount() {
  try {
    log('\n📱 Instagram Account Details', 'cyan');
    log('==============================', 'cyan');
    
    // First, get pages
    const pagesResponse = await axios.get(`${GRAPH_API_URL}/me/accounts`, {
      params: {
        access_token: PAGE_ACCESS_TOKEN,
        fields: 'id,name,instagram_business_account'
      }
    });
    
    const pages = pagesResponse.data.data;
    
    for (const page of pages) {
      if (page.instagram_business_account) {
        const igId = page.instagram_business_account.id;
        
        // Get Instagram account details
        const igResponse = await axios.get(`${GRAPH_API_URL}/${igId}`, {
          params: {
            access_token: PAGE_ACCESS_TOKEN,
            fields: 'id,username,name,followers_count,media_count,profile_picture_url'
          }
        });
        
        const igAccount = igResponse.data;
        
        log(`✅ Instagram Business Account Found:`, 'green');
        log(`   ID: ${igAccount.id}`, 'yellow');
        log(`   Username: @${igAccount.username}`, 'yellow');
        log(`   Name: ${igAccount.name}`, 'yellow');
        log(`   Followers: ${igAccount.followers_count || 'N/A'}`, 'yellow');
        log(`   Posts: ${igAccount.media_count || 'N/A'}`, 'yellow');
        log(`   Connected to Page: ${page.name}`, 'yellow');
        
        return igAccount.id;
      }
    }
    
    log('❌ No Instagram Business Account connected', 'red');
    return null;
    
  } catch (error) {
    log(`❌ Error getting Instagram account: ${error.response?.data?.error?.message || error.message}`, 'red');
    return null;
  }
}

// Check webhook subscriptions
async function checkWebhookSubscriptions(instagramId) {
  try {
    log('\n🔔 Webhook Subscriptions', 'cyan');
    log('==============================', 'cyan');
    
    const response = await axios.get(
      `${GRAPH_API_URL}/${instagramId}/subscribed_apps`,
      {
        params: {
          access_token: INSTAGRAM_ACCESS_TOKEN
        }
      }
    );
    
    if (response.data.data && response.data.data.length > 0) {
      log('✅ Active webhook subscriptions:', 'green');
      
      response.data.data.forEach(sub => {
        log(`\n   App ID: ${sub.id}`, 'yellow');
        
        if (sub.subscribed_fields && sub.subscribed_fields.length > 0) {
          log('   Subscribed fields:', 'yellow');
          sub.subscribed_fields.forEach(field => {
            const fieldStatus = ['messages', 'messaging_postbacks', 'messaging_seen'].includes(field) ? '✅' : '⚠️';
            log(`     ${fieldStatus} ${field}`, fieldStatus === '✅' ? 'green' : 'yellow');
          });
        } else {
          log('   ❌ No fields subscribed', 'red');
        }
      });
      
      // Check if required fields are subscribed
      const requiredFields = ['messages'];
      const hasRequired = response.data.data.some(sub => 
        sub.subscribed_fields && requiredFields.every(field => 
          sub.subscribed_fields.includes(field)
        )
      );
      
      if (!hasRequired) {
        log('\n⚠️  Warning: "messages" field is not subscribed!', 'yellow');
        log('   Run subscribe-instagram-webhook.js to fix this', 'yellow');
      }
      
      return true;
    } else {
      log('❌ No webhook subscriptions found', 'red');
      log('   Run: node scripts/subscribe-instagram-webhook.js', 'yellow');
      return false;
    }
    
  } catch (error) {
    log(`❌ Error checking subscriptions: ${error.response?.data?.error?.message || error.message}`, 'red');
    return false;
  }
}

// Test webhook endpoint
async function testWebhookEndpoint() {
  try {
    log('\n🌐 Webhook Endpoint Test', 'cyan');
    log('==============================', 'cyan');
    
    log(`Testing: ${WEBHOOK_URL}`, 'yellow');
    
    // Test webhook verification
    const verifyParams = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': process.env.VERIFY_TOKEN || 'test_token',
      'hub.challenge': 'test_challenge_12345'
    });
    
    const response = await axios.get(`${WEBHOOK_URL}?${verifyParams}`, {
      timeout: 5000
    });
    
    if (response.data === 'test_challenge_12345') {
      log('✅ Webhook verification endpoint working', 'green');
    } else {
      log('⚠️  Webhook responded but with unexpected data', 'yellow');
    }
    
    return true;
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('❌ Cannot connect to webhook URL', 'red');
      log('   Make sure your server is running', 'yellow');
    } else if (error.response?.status === 403) {
      log('⚠️  Webhook returned 403 - Check VERIFY_TOKEN', 'yellow');
    } else {
      log(`❌ Webhook test failed: ${error.message}`, 'red');
    }
    return false;
  }
}

// Check app permissions
async function checkAppPermissions() {
  try {
    log('\n🔐 App Permissions', 'cyan');
    log('==============================', 'cyan');
    
    if (!APP_ID) {
      log('⚠️  APP_ID not set, skipping permission check', 'yellow');
      return;
    }
    
    const response = await axios.get(`${GRAPH_API_URL}/${APP_ID}`, {
      params: {
        access_token: `${APP_ID}|${APP_SECRET}`,
        fields: 'name,id'
      }
    });
    
    log(`✅ App Name: ${response.data.name}`, 'green');
    log(`   App ID: ${response.data.id}`, 'yellow');
    
    // Check token permissions
    const debugResponse = await axios.get(`${GRAPH_API_URL}/debug_token`, {
      params: {
        input_token: PAGE_ACCESS_TOKEN,
        access_token: `${APP_ID}|${APP_SECRET}`
      }
    });
    
    const tokenData = debugResponse.data.data;
    
    if (tokenData.scopes) {
      log('\n   Token Permissions:', 'yellow');
      const requiredScopes = ['pages_messaging', 'instagram_basic', 'instagram_manage_messages'];
      
      tokenData.scopes.forEach(scope => {
        const isRequired = requiredScopes.includes(scope);
        log(`     ${isRequired ? '✅' : '  '} ${scope}`, isRequired ? 'green' : 'cyan');
      });
      
      // Check for missing required scopes
      const missingScopes = requiredScopes.filter(scope => !tokenData.scopes.includes(scope));
      if (missingScopes.length > 0) {
        log('\n⚠️  Missing required permissions:', 'yellow');
        missingScopes.forEach(scope => {
          log(`     ❌ ${scope}`, 'red');
        });
      }
    }
    
  } catch (error) {
    log(`⚠️  Could not check app permissions: ${error.response?.data?.error?.message || error.message}`, 'yellow');
  }
}

// Send test webhook
async function sendTestWebhook() {
  try {
    log('\n🧪 Sending Test Webhook', 'cyan');
    log('==============================', 'cyan');
    
    const testPayload = {
      object: 'instagram',
      entry: [
        {
          id: INSTAGRAM_ID || '123456789',
          time: Date.now(),
          messaging: [
            {
              sender: {
                id: 'test_user_verification'
              },
              recipient: {
                id: INSTAGRAM_ID || '123456789'
              },
              timestamp: Date.now(),
              message: {
                mid: `test_mid_${Date.now()}`,
                text: 'Test message from verification script'
              }
            }
          ]
        }
      ]
    };
    
    const response = await axios.post(WEBHOOK_URL, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=test_signature'
      },
      timeout: 5000
    });
    
    if (response.status === 200) {
      log('✅ Test webhook sent successfully', 'green');
      log(`   Response: ${response.data}`, 'yellow');
    } else {
      log(`⚠️  Webhook returned status ${response.status}`, 'yellow');
    }
    
  } catch (error) {
    if (error.response?.status === 403) {
      log('⚠️  Webhook rejected test (403) - This is expected with signature verification', 'yellow');
      log('   Set SKIP_WEBHOOK_VERIFICATION=true in .env for testing', 'yellow');
    } else {
      log(`❌ Test webhook failed: ${error.message}`, 'red');
    }
  }
}

// Main verification function
async function main() {
  log('\n🔍 Instagram Webhook Verification Tool', 'magenta');
  log('======================================', 'magenta');
  
  // Check environment
  const envOk = checkEnvironment();
  if (!envOk) {
    log('\n❌ Missing required environment variables', 'red');
    process.exit(1);
  }
  
  // Get Instagram account
  const instagramId = INSTAGRAM_ID || await getInstagramAccount();
  
  if (!instagramId) {
    log('\n❌ Could not find Instagram account', 'red');
    log('   Please connect Instagram to your Facebook Page', 'yellow');
    process.exit(1);
  }
  
  // Check webhook subscriptions
  const hasSubscriptions = await checkWebhookSubscriptions(instagramId);
  
  // Check app permissions
  await checkAppPermissions();
  
  // Test webhook endpoint
  const webhookOk = await testWebhookEndpoint();
  
  // Send test webhook
  if (webhookOk) {
    await sendTestWebhook();
  }
  
  // Summary
  log('\n📊 Verification Summary', 'magenta');
  log('======================================', 'magenta');
  
  const checks = [
    { name: 'Environment Variables', status: envOk },
    { name: 'Instagram Account Connected', status: !!instagramId },
    { name: 'Webhook Subscriptions', status: hasSubscriptions },
    { name: 'Webhook Endpoint', status: webhookOk }
  ];
  
  checks.forEach(check => {
    log(`${check.status ? '✅' : '❌'} ${check.name}`, check.status ? 'green' : 'red');
  });
  
  const allPassed = checks.every(c => c.status);
  
  if (allPassed) {
    log('\n✅ All checks passed! Instagram webhooks should be working.', 'green');
    log('\n📱 Next Steps:', 'blue');
    log('1. Send a message to your Instagram business account', 'yellow');
    log('2. Check server logs for webhook events', 'yellow');
    log(`3. View captured webhooks at: ${WEBHOOK_URL.replace('/webhook', '/debug/webhooks')}`, 'yellow');
  } else {
    log('\n⚠️  Some checks failed. Please fix the issues above.', 'yellow');
    
    if (!hasSubscriptions) {
      log('\n💡 To fix webhook subscriptions:', 'blue');
      log('   node scripts/subscribe-instagram-webhook.js', 'yellow');
    }
  }
}

// Run verification
main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});