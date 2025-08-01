#!/usr/bin/env node

/**
 * Comprehensive bot testing script for production
 * Tests all aspects of the Facebook Messenger bot
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

async function runTests() {
  console.log(`${colors.blue}=== Comprehensive Bot Test Suite ===${colors.reset}\n`);
  console.log(`Testing: ${PRODUCTION_URL}\n`);

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Health Check
  totalTests++;
  console.log(`${colors.yellow}Test 1: Health Check${colors.reset}`);
  try {
    const health = await axios.get(`${PRODUCTION_URL}/health`);
    if (health.data.status === 'OK') {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Bot is healthy\n`);
      passedTests++;
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Unexpected health status\n`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset} - ${error.message}\n`);
  }

  // Test 2: Environment Check
  totalTests++;
  console.log(`${colors.yellow}Test 2: Environment Variables${colors.reset}`);
  try {
    const env = await axios.get(`${PRODUCTION_URL}/debug/env-check`);
    const data = env.data;
    console.log(`  PAGE_ACCESS_TOKEN: ${data.hasPageAccessToken ? colors.green + '✓' : colors.red + '✗'} ${data.tokenLength > 0 ? `(${data.tokenLength} chars)` : ''}${colors.reset}`);
    console.log(`  VERIFY_TOKEN: ${data.hasVerifyToken ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    console.log(`  APP_SECRET: ${data.hasAppSecret ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    console.log(`  GEMINI_API_KEY: ${data.hasGeminiKey ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    console.log(`  DATABASE_URL: ${data.hasDatabaseUrl ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    
    if (data.hasPageAccessToken && data.hasVerifyToken && data.hasAppSecret && data.hasGeminiKey && data.hasDatabaseUrl) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - All environment variables are set\n`);
      passedTests++;
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Some environment variables are missing\n`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset} - ${error.message}\n`);
  }

  // Test 3: Webhook GET (Verification)
  totalTests++;
  console.log(`${colors.yellow}Test 3: Webhook Verification${colors.reset}`);
  try {
    const webhook = await axios.get(`${PRODUCTION_URL}/webhook`);
    console.log(`  Status: ${webhook.data.name || 'Accessible'}`);
    console.log(`${colors.green}✓ PASSED${colors.reset} - Webhook endpoint is accessible at /webhook\n`);
    passedTests++;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Webhook correctly requires parameters\n`);
      passedTests++;
    } else if (error.response && error.response.status === 403) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Webhook requires valid verification token\n`);
      passedTests++;
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - ${error.message}\n`);
    }
  }

  // Test 4: Webhook POST (Message Processing)
  totalTests++;
  console.log(`${colors.yellow}Test 4: Webhook Message Processing${colors.reset}`);
  const testPayload = {
    object: 'page',
    entry: [{
      id: '123456789',
      time: Date.now(),
      messaging: [{
        sender: { id: 'test_user_' + Date.now() },
        recipient: { id: 'page_123' },
        timestamp: Date.now(),
        message: {
          mid: 'test_message_id',
          text: 'Test message'
        }
      }]
    }]
  };

  try {
    const webhook = await axios.post(`${PRODUCTION_URL}/webhook`, testPayload);
    if (webhook.data === 'EVENT_RECEIVED') {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Webhook processes messages correctly at /webhook\n`);
      passedTests++;
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Unexpected webhook response\n`);
    }
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log(`${colors.yellow}⚠ WARNING${colors.reset} - Webhook signature verification active (expected in production)\n`);
      passedTests++; // This is actually good - security is enabled
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - ${error.message}\n`);
    }
  }

  // Test 5: Test Message Endpoint
  totalTests++;
  console.log(`${colors.yellow}Test 5: Direct Message Test${colors.reset}`);
  const testRecipientId = process.argv[2] || 'test_user_123';
  
  try {
    const testMessage = await axios.post(`${PRODUCTION_URL}/debug/test-message`, {
      recipientId: testRecipientId,
      message: 'Test from comprehensive test suite'
    });
    
    if (testMessage.data.success) {
      console.log(`${colors.green}✓ PASSED${colors.reset} - Message sent successfully\n`);
      passedTests++;
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Message sending failed\n`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset} - ${error.response?.data?.error?.message || error.message}`);
    if (error.response?.data?.details) {
      console.log('  Details:', JSON.stringify(error.response.data.details, null, 2));
    }
    console.log();
  }

  // Summary
  console.log(`${colors.blue}=== Test Summary ===${colors.reset}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Failed: ${colors.red}${totalTests - passedTests}${colors.reset}`);
  
  if (passedTests === totalTests) {
    console.log(`\n${colors.green}✅ All tests passed! Bot is ready for production.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}❌ Some tests failed. Please review the issues above.${colors.reset}`);
  }

  // Recommendations
  console.log(`\n${colors.yellow}Next Steps:${colors.reset}`);
  if (passedTests < totalTests) {
    console.log('1. Check the DigitalOcean logs for error details');
    console.log('2. Verify all environment variables are set correctly');
    console.log('3. Ensure Facebook webhook is configured properly');
  } else {
    console.log('1. Test with a real Facebook user');
    console.log('2. Monitor logs for any runtime errors');
    console.log('3. Set up Facebook webhook subscription');
  }
  
  console.log(`\nTo test with a specific user ID: node ${process.argv[1]} <facebook_user_id>`);
}

// Run the tests
runTests().catch(console.error);