#!/usr/bin/env node

/**
 * Test Facebook API connectivity and permissions
 * This script helps diagnose Facebook messaging issues
 */

require('dotenv').config();
const axios = require('axios');

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testFacebookAPI() {
  console.log(`${colors.blue}=== Facebook API Test Script ===${colors.reset}\n`);

  if (!PAGE_ACCESS_TOKEN) {
    console.error(`${colors.red}❌ PAGE_ACCESS_TOKEN not found in environment variables${colors.reset}`);
    return;
  }

  console.log(`${colors.green}✓ PAGE_ACCESS_TOKEN found${colors.reset}`);
  console.log(`Token length: ${PAGE_ACCESS_TOKEN.length} characters\n`);

  // Test 1: Verify token validity
  console.log(`${colors.yellow}1. Testing token validity...${colors.reset}`);
  try {
    const tokenResponse = await axios.get(`${FACEBOOK_API_URL}/debug_token`, {
      params: {
        input_token: PAGE_ACCESS_TOKEN,
        access_token: PAGE_ACCESS_TOKEN
      }
    });
    
    const tokenData = tokenResponse.data.data;
    console.log(`${colors.green}✓ Token is valid${colors.reset}`);
    console.log(`  App ID: ${tokenData.app_id}`);
    console.log(`  Type: ${tokenData.type}`);
    console.log(`  Expires: ${tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toLocaleString() : 'Never'}`);
    console.log(`  Scopes: ${tokenData.scopes.join(', ')}\n`);
  } catch (error) {
    console.error(`${colors.red}❌ Token validation failed:${colors.reset}`, error.response?.data || error.message);
  }

  // Test 2: Get page information
  console.log(`${colors.yellow}2. Getting page information...${colors.reset}`);
  try {
    const pageResponse = await axios.get(`${FACEBOOK_API_URL}/me`, {
      params: {
        access_token: PAGE_ACCESS_TOKEN,
        fields: 'id,name,fan_count,messaging'
      }
    });
    
    const pageData = pageResponse.data;
    console.log(`${colors.green}✓ Page information retrieved${colors.reset}`);
    console.log(`  Page Name: ${pageData.name}`);
    console.log(`  Page ID: ${pageData.id}`);
    console.log(`  Fan Count: ${pageData.fan_count || 'N/A'}\n`);
  } catch (error) {
    console.error(`${colors.red}❌ Failed to get page info:${colors.reset}`, error.response?.data || error.message);
  }

  // Test 3: Check messenger profile
  console.log(`${colors.yellow}3. Checking messenger profile...${colors.reset}`);
  try {
    const profileResponse = await axios.get(`${FACEBOOK_API_URL}/me/messenger_profile`, {
      params: {
        access_token: PAGE_ACCESS_TOKEN,
        fields: 'get_started,greeting,persistent_menu'
      }
    });
    
    const profileData = profileResponse.data.data;
    if (profileData && profileData.length > 0) {
      console.log(`${colors.green}✓ Messenger profile configured${colors.reset}`);
      console.log(`  Get Started: ${profileData[0].get_started ? 'Yes' : 'No'}`);
      console.log(`  Greeting: ${profileData[0].greeting ? 'Yes' : 'No'}`);
      console.log(`  Persistent Menu: ${profileData[0].persistent_menu ? 'Yes' : 'No'}\n`);
    } else {
      console.log(`${colors.yellow}⚠ Messenger profile not configured${colors.reset}\n`);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Failed to check messenger profile:${colors.reset}`, error.response?.data || error.message);
  }

  // Test 4: Send a test message (requires a valid recipient ID)
  console.log(`${colors.yellow}4. Test message sending capability...${colors.reset}`);
  const testRecipientId = process.argv[2];
  
  if (testRecipientId) {
    try {
      const messageResponse = await axios.post(
        `${FACEBOOK_API_URL}/me/messages`,
        {
          recipient: { id: testRecipientId },
          message: { text: 'Test message from ESSEN Bot - Your bot is working!' }
        },
        {
          params: { access_token: PAGE_ACCESS_TOKEN },
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      console.log(`${colors.green}✓ Test message sent successfully${colors.reset}`);
      console.log(`  Message ID: ${messageResponse.data.message_id}\n`);
    } catch (error) {
      console.error(`${colors.red}❌ Failed to send test message:${colors.reset}`);
      const errorData = error.response?.data?.error;
      if (errorData) {
        console.error(`  Error: ${errorData.message}`);
        console.error(`  Type: ${errorData.type}`);
        console.error(`  Code: ${errorData.code}`);
        
        // Common error explanations
        if (errorData.code === 10) {
          console.error(`  ${colors.yellow}→ This error means the user hasn't messaged your page or the app lacks permission${colors.reset}`);
        } else if (errorData.code === 230) {
          console.error(`  ${colors.yellow}→ This error means the user has blocked messages from your page${colors.reset}`);
        }
      }
    }
  } else {
    console.log(`  ${colors.yellow}ℹ To test sending messages, run: node test-facebook-api.js <recipient_facebook_id>${colors.reset}\n`);
  }

  // Test 5: Check subscribed fields
  console.log(`${colors.yellow}5. Checking webhook subscriptions...${colors.reset}`);
  try {
    const subscriptionsResponse = await axios.get(`${FACEBOOK_API_URL}/me/subscribed_apps`, {
      params: {
        access_token: PAGE_ACCESS_TOKEN
      }
    });
    
    const subscriptions = subscriptionsResponse.data.data;
    if (subscriptions && subscriptions.length > 0) {
      console.log(`${colors.green}✓ Webhook subscriptions active${colors.reset}`);
      subscriptions.forEach(sub => {
        console.log(`  Subscribed fields: ${sub.subscribed_fields.join(', ')}`);
      });
    } else {
      console.log(`${colors.red}❌ No webhook subscriptions found${colors.reset}`);
      console.log(`  ${colors.yellow}→ The page needs to subscribe to webhook events${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Failed to check subscriptions:${colors.reset}`, error.response?.data || error.message);
  }

  console.log(`\n${colors.blue}=== Test Complete ===${colors.reset}`);
  
  // Summary
  console.log(`\n${colors.yellow}Summary:${colors.reset}`);
  console.log('1. If token validation passed but messaging fails, check Facebook app review status');
  console.log('2. Ensure your app has been approved for pages_messaging permission');
  console.log('3. For development, use test users or page admins');
  console.log('4. Check https://developers.facebook.com/apps for your app status');
}

// Run the test
testFacebookAPI().catch(console.error);