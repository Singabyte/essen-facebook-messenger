#!/usr/bin/env node

// Test script for Instagram messaging functionality
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const WEBHOOK_URL = `http://localhost:${process.env.PORT || 3000}/webhook`;

// Simulate Instagram webhook payloads
const simulateInstagramMessage = async (messageText = "Hello from Instagram!") => {
  console.log('\n📷 Testing Instagram Message Reception...');
  console.log('=====================================');
  
  const instagramPayload = {
    object: 'instagram',
    entry: [
      {
        id: process.env.INSTAGRAM_ID || '123456789',
        time: Date.now(),
        messaging: [
          {
            sender: {
              id: 'instagram_test_user_123'
            },
            recipient: {
              id: process.env.INSTAGRAM_ID || '123456789'
            },
            timestamp: Date.now(),
            message: {
              mid: `ig_mid_${Date.now()}`,
              text: messageText
            }
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(WEBHOOK_URL, instagramPayload, {
      headers: {
        'Content-Type': 'application/json',
        // Simulate Facebook signature (in production, this would be validated)
        'x-hub-signature-256': 'sha256=test_signature'
      }
    });

    console.log('✅ Instagram message sent successfully');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error sending Instagram message:', error.response?.data || error.message);
    return false;
  }
};

// Simulate Instagram DM format (alternative format)
const simulateInstagramDM = async (messageText = "Instagram DM test") => {
  console.log('\n📸 Testing Instagram DM Format...');
  console.log('=====================================');
  
  const dmPayload = {
    object: 'instagram',
    entry: [
      {
        id: process.env.INSTAGRAM_ID || '123456789',
        time: Date.now(),
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'instagram',
              metadata: {
                recipient_id: process.env.INSTAGRAM_ID
              },
              messages: [
                {
                  id: `ig_dm_${Date.now()}`,
                  from: {
                    id: 'instagram_dm_user_456',
                    username: 'test_user'
                  },
                  text: {
                    body: messageText
                  },
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'text'
                }
              ]
            }
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(WEBHOOK_URL, dmPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=test_signature'
      }
    });

    console.log('✅ Instagram DM sent successfully');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error sending Instagram DM:', error.response?.data || error.message);
    return false;
  }
};

// Simulate Facebook message for comparison
const simulateFacebookMessage = async (messageText = "Hello from Facebook!") => {
  console.log('\n💬 Testing Facebook Message Reception...');
  console.log('=====================================');
  
  const facebookPayload = {
    object: 'page',
    entry: [
      {
        id: '123456789',
        time: Date.now(),
        messaging: [
          {
            sender: {
              id: 'facebook_test_user_789'
            },
            recipient: {
              id: '123456789'
            },
            timestamp: Date.now(),
            message: {
              mid: `fb_mid_${Date.now()}`,
              text: messageText
            }
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(WEBHOOK_URL, facebookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=test_signature'
      }
    });

    console.log('✅ Facebook message sent successfully');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error sending Facebook message:', error.response?.data || error.message);
    return false;
  }
};

// Test webhook verification
const testWebhookVerification = async () => {
  console.log('\n🔐 Testing Webhook Verification...');
  console.log('=====================================');
  
  const params = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': process.env.VERIFY_TOKEN || 'essen_verify_token_12345',
    'hub.challenge': 'test_challenge_12345'
  });

  try {
    const response = await axios.get(`${WEBHOOK_URL}?${params}`);
    console.log('✅ Webhook verification successful');
    console.log('Challenge response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Webhook verification failed:', error.response?.data || error.message);
    return false;
  }
};

// Check server health
const checkServerHealth = async () => {
  console.log('\n🏥 Checking Server Health...');
  console.log('=====================================');
  
  try {
    const response = await axios.get(`http://localhost:${process.env.PORT || 3000}/health`);
    console.log('✅ Server is healthy');
    console.log('Health status:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    console.log('\n⚠️  Make sure the server is running: npm run dev');
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Instagram Integration Tests');
  console.log('========================================\n');
  console.log('Configuration:');
  console.log(`- Server URL: ${WEBHOOK_URL}`);
  console.log(`- Instagram ID: ${process.env.INSTAGRAM_ID || 'Not configured'}`);
  console.log(`- Instagram Token: ${process.env.INSTAGRAM_ACCESS_TOKEN ? '✅ Configured' : '❌ Not configured'}\n`);

  const results = [];

  // Check if server is running
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    console.log('\n❌ Server is not running. Please start it first.');
    process.exit(1);
  }

  // Run tests
  results.push({
    test: 'Webhook Verification',
    passed: await testWebhookVerification()
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  results.push({
    test: 'Facebook Message',
    passed: await simulateFacebookMessage('Testing Facebook platform')
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  results.push({
    test: 'Instagram Message',
    passed: await simulateInstagramMessage('Testing Instagram platform')
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  results.push({
    test: 'Instagram DM Format',
    passed: await simulateInstagramDM('Testing Instagram DM format')
  });

  // Test with image attachment
  console.log('\n📸 Testing Instagram with Image...');
  console.log('=====================================');
  
  const imagePayload = {
    object: 'instagram',
    entry: [
      {
        id: process.env.INSTAGRAM_ID || '123456789',
        time: Date.now(),
        messaging: [
          {
            sender: {
              id: 'instagram_image_user_999'
            },
            recipient: {
              id: process.env.INSTAGRAM_ID || '123456789'
            },
            timestamp: Date.now(),
            message: {
              mid: `ig_image_${Date.now()}`,
              text: 'Check out this furniture!',
              attachments: [
                {
                  type: 'image',
                  payload: {
                    url: 'https://example.com/furniture.jpg'
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(WEBHOOK_URL, imagePayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=test_signature'
      }
    });
    console.log('✅ Instagram image message sent successfully');
    results.push({
      test: 'Instagram Image Message',
      passed: true
    });
  } catch (error) {
    console.error('❌ Error sending Instagram image:', error.response?.data || error.message);
    results.push({
      test: 'Instagram Image Message',
      passed: false
    });
  }

  // Print summary
  console.log('\n\n📊 Test Results Summary');
  console.log('========================');
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.passed ? 'PASSED' : 'FAILED'}`);
  });

  console.log('\n------------------------');
  console.log(`Total: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Instagram integration is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the logs above for details.');
  }

  console.log('\n📝 Note: Check the server logs for detailed message processing information.');
  console.log('💡 Tip: Run the database migration script to add platform support:');
  console.log('   node scripts/migrate-instagram.js\n');
};

// Run the tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});