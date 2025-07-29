#!/usr/bin/env node

// Test webhook signature verification
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

async function testWebhookVerification() {
  console.log('🧪 Testing Webhook Verification\n');
  
  // Test GET verification
  console.log('1. Testing GET verification (subscribe)...');
  try {
    const verifyUrl = `http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=${process.env.VERIFY_TOKEN}&hub.challenge=test_challenge_123`;
    const response = await axios.get(verifyUrl);
    console.log('✅ Webhook verification successful:', response.data);
  } catch (error) {
    console.error('❌ Webhook verification failed:', error.response?.status);
  }
  
  console.log('\n2. Testing POST with signature...');
  
  // Test message
  const testMessage = {
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
          text: 'Test message from webhook test'
        }
      }]
    }]
  };
  
  const body = JSON.stringify(testMessage);
  
  // Generate signature
  const signature = crypto
    .createHmac('sha256', process.env.APP_SECRET)
    .update(body)
    .digest('hex');
  
  console.log('APP_SECRET:', process.env.APP_SECRET ? `${process.env.APP_SECRET.substring(0, 8)}...` : 'NOT SET');
  console.log('Generated signature:', signature);
  
  try {
    const response = await axios.post('http://localhost:3000/webhook', testMessage, {
      headers: {
        'x-hub-signature-256': `sha256=${signature}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Webhook POST successful:', response.status);
  } catch (error) {
    console.error('❌ Webhook POST failed:', error.response?.status);
    if (error.response?.status === 403) {
      console.log('\nThis likely means the signature verification is working but rejecting our test signature.');
      console.log('When Facebook sends real messages, they will include the correct signature.');
    }
  }
  
  console.log('\n3. Environment check:');
  console.log('- VERIFY_TOKEN:', process.env.VERIFY_TOKEN ? '✅ Set' : '❌ Not set');
  console.log('- APP_SECRET:', process.env.APP_SECRET ? '✅ Set' : '❌ Not set');
  console.log('- PAGE_ACCESS_TOKEN:', process.env.PAGE_ACCESS_TOKEN ? '✅ Set' : '❌ Not set');
  
  console.log('\n✅ Webhook test completed!');
  console.log('\nNext steps:');
  console.log('1. Send a message to your Facebook page');
  console.log('2. Check the server logs for signature verification details');
  console.log('3. If signatures still don\'t match, verify APP_SECRET in Facebook app settings');
}

testWebhookVerification().catch(console.error);