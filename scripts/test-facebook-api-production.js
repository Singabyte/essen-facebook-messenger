#!/usr/bin/env node

/**
 * Test Facebook API connectivity in production
 * This script tests the deployed bot's Facebook connectivity
 */

const axios = require('axios');

const PRODUCTION_URL = 'https://essen-messenger-bot-zxxtw.ondigitalocean.app';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testProductionFacebookAPI() {
  console.log(`${colors.blue}=== Production Facebook API Test ===${colors.reset}\n`);
  console.log(`Testing bot at: ${PRODUCTION_URL}\n`);

  // Test 1: Check if bot is running
  console.log(`${colors.yellow}1. Checking bot health...${colors.reset}`);
  try {
    const healthResponse = await axios.get(`${PRODUCTION_URL}/health`);
    console.log(`${colors.green}✓ Bot is running${colors.reset}`);
    console.log(`  Status: ${healthResponse.data.status}`);
    console.log(`  Timestamp: ${healthResponse.data.timestamp}\n`);
  } catch (error) {
    console.error(`${colors.red}❌ Bot health check failed${colors.reset}`);
    console.error(`  Error: ${error.message}\n`);
    return;
  }

  // Test 2: Check webhook verification
  console.log(`${colors.yellow}2. Testing webhook verification...${colors.reset}`);
  try {
    // This should return 400 (missing parameters) which confirms webhook is set up
    const webhookResponse = await axios.get(`${PRODUCTION_URL}/webhook`);
    console.log(`${colors.green}✓ Webhook endpoint is accessible${colors.reset}`);
    console.log(`  Response: ${JSON.stringify(webhookResponse.data)}\n`);
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log(`${colors.green}✓ Webhook verification logic is working${colors.reset}`);
      console.log(`  Returns 400 for missing parameters (expected behavior)\n`);
    } else {
      console.error(`${colors.red}❌ Webhook test failed${colors.reset}`);
      console.error(`  Error: ${error.message}\n`);
    }
  }

  // Test 3: Send a test webhook message
  console.log(`${colors.yellow}3. Testing webhook message processing...${colors.reset}`);
  const testPayload = {
    object: 'page',
    entry: [{
      id: '123456789',
      time: Date.now(),
      messaging: [{
        sender: { id: 'test_user_123' },
        recipient: { id: 'page_123' },
        timestamp: Date.now(),
        message: {
          mid: 'test_message_id',
          text: 'Test message from diagnostic script'
        }
      }]
    }]
  };

  try {
    const messageResponse = await axios.post(`${PRODUCTION_URL}/webhook`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'test_signature' // This will fail signature check but that's OK for testing
      }
    });
    
    if (messageResponse.status === 200 && messageResponse.data === 'EVENT_RECEIVED') {
      console.log(`${colors.green}✓ Webhook processes messages successfully${colors.reset}`);
      console.log(`  Response: ${messageResponse.data}\n`);
    }
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log(`${colors.yellow}⚠ Webhook signature verification is enabled (good security)${colors.reset}`);
      console.log(`  The bot properly rejects unsigned requests\n`);
    } else {
      console.error(`${colors.red}❌ Webhook message test failed${colors.reset}`);
      console.error(`  Error: ${error.response?.status} ${error.response?.statusText || error.message}\n`);
    }
  }

  // Test 4: Check admin API
  console.log(`${colors.yellow}4. Checking admin API...${colors.reset}`);
  try {
    const adminResponse = await axios.get(`${PRODUCTION_URL}/api`);
    console.log(`${colors.green}✓ Admin API is running${colors.reset}`);
    console.log(`  Version: ${adminResponse.data.version}`);
    console.log(`  Available endpoints: ${Object.keys(adminResponse.data.endpoints || {}).join(', ')}\n`);
  } catch (error) {
    console.error(`${colors.red}❌ Admin API check failed${colors.reset}`);
    console.error(`  Error: ${error.message}\n`);
  }

  console.log(`${colors.blue}=== Production Test Complete ===${colors.reset}\n`);
  
  // Summary and recommendations
  console.log(`${colors.yellow}Troubleshooting Facebook Messaging:${colors.reset}`);
  console.log('\n1. Check Facebook Developer Console:');
  console.log('   - Verify PAGE_ACCESS_TOKEN is set in DigitalOcean environment');
  console.log('   - Ensure webhook URL is: ' + PRODUCTION_URL + '/webhook');
  console.log('   - Subscribe to "messages" and "messaging_postbacks" events');
  console.log('   - Verify VERIFY_TOKEN matches in both Facebook and DigitalOcean');
  
  console.log('\n2. Test with a real Facebook user:');
  console.log('   - Have someone message your Facebook page');
  console.log('   - Check DigitalOcean logs for any errors');
  console.log('   - Monitor admin interface at ' + PRODUCTION_URL + '/admin');
  
  console.log('\n3. Common issues:');
  console.log('   - App in development mode (only admins/testers can use)');
  console.log('   - Missing pages_messaging permission');
  console.log('   - Incorrect webhook verification token');
  console.log('   - PAGE_ACCESS_TOKEN not set in DigitalOcean environment');
}

// Run the test
testProductionFacebookAPI().catch(console.error);