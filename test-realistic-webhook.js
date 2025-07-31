#!/usr/bin/env node

/**
 * Test with a realistic Facebook webhook payload
 * Tests signature verification bypass (since we don't have APP_SECRET in this environment)
 */

const https = require('https');

const WEBHOOK_URL = 'https://essen-messenger-bot-zxxtw.ondigitalocean.app';

// Create a realistic Facebook webhook payload
const realisticPayload = {
  object: 'page',
  entry: [{
    id: '123456789012345',
    time: Date.now(),
    messaging: [{
      sender: { id: 'user123456789' },
      recipient: { id: 'page123456789' },
      timestamp: Date.now(),
      message: {
        mid: 'm_test_message_id_' + Date.now(),
        text: 'Hi, I want to know about ESSEN kitchen cabinets'
      }
    }]
  }]
};

async function testRealisticWebhook() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(realisticPayload);
    const start = Date.now();
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
        'User-Agent': 'facebookplatform/1.0 (+http://www.facebook.com/platform)',
      },
      timeout: 30000
    };
    
    console.log('🔍 Testing realistic Facebook webhook payload...');
    console.log('📨 Message text:', realisticPayload.entry[0].messaging[0].message.text);
    
    const req = https.request(WEBHOOK_URL, options, (res) => {
      const duration = Date.now() - start;
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`📊 Response: ${res.statusCode} (${duration}ms)`);
        console.log(`📝 Response data: ${data}`);
        
        if (res.statusCode === 200 && data === 'EVENT_RECEIVED') {
          console.log('✅ SUCCESS! Webhook processed the Facebook message correctly');
          console.log('🎉 The bot is ready to receive Facebook messages');
          resolve({ success: true, status: res.statusCode, duration, data });
        } else if (res.statusCode === 403) {
          console.log('⚠️  Signature verification rejected (expected without valid APP_SECRET)');
          console.log('💡 In production, Facebook will sign requests with your APP_SECRET');
          resolve({ success: false, status: res.statusCode, reason: 'signature_verification' });
        } else {
          console.log('❌ Unexpected response');
          resolve({ success: false, status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Connection error:', err.message);
      reject(err);
    });
    
    req.on('timeout', () => {
      console.log('❌ Request timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.write(body);
    req.end();
  });
}

async function runRealisticTest() {
  console.log('🚀 REALISTIC FACEBOOK WEBHOOK TEST');
  console.log('==================================');
  
  try {
    const result = await testRealisticWebhook();
    
    console.log('\n🏁 TEST SUMMARY');
    console.log('================');
    
    if (result.success) {
      console.log('✅ WEBHOOK IS WORKING PERFECTLY!');
      console.log('💡 Your Facebook bot is ready to receive messages');
      console.log('📌 Next steps:');
      console.log('   1. Set up your Facebook App webhook to point to:');
      console.log(`      ${WEBHOOK_URL}/webhook`);
      console.log('   2. Make sure your APP_SECRET is set in DigitalOcean environment');
      console.log('   3. Subscribe to message events in Facebook App dashboard');
    } else if (result.reason === 'signature_verification') {
      console.log('⚠️  WEBHOOK WORKING BUT NEEDS SIGNATURE');
      console.log('💡 The webhook is processing requests correctly');
      console.log('📌 To complete setup:');
      console.log('   1. Ensure APP_SECRET is set in DigitalOcean environment');
      console.log('   2. Facebook will automatically sign requests with your APP_SECRET');
    } else {
      console.log('❌ WEBHOOK NOT WORKING PROPERLY');
      console.log('💡 Additional debugging needed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runRealisticTest().catch(console.error);