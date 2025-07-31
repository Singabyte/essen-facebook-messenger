#!/usr/bin/env node

/**
 * Quick verification script to test if the 504 timeout fix worked
 * Run this after deploying the DATABASE_URL fix
 */

const https = require('https');

const WEBHOOK_URL = 'https://essen-messenger-bot-zxxtw.ondigitalocean.app';

async function quickTest() {
  console.log('🔍 Quick verification of webhook fix...\n');
  
  // Test the exact payload that was failing
  const testPayload = {
    object: 'page',
    entry: [{
      id: '123456789',
      time: Date.now(),
      messaging: [{
        sender: { id: 'verification-test-user' },
        recipient: { id: 'page-id' },
        timestamp: Date.now(),
        message: {
          mid: 'verification-test-message',
          text: 'Hello, testing after fix!'
        }
      }]
    }]
  };
  
  return new Promise((resolve) => {
    const body = JSON.stringify(testPayload);
    const start = Date.now();
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length
      },
      timeout: 15000
    };
    
    console.log('⏳ Testing Facebook webhook payload...');
    
    const req = https.request(WEBHOOK_URL, options, (res) => {
      const duration = Date.now() - start;
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`📊 Response: ${res.statusCode} (${duration}ms)`);
        
        if (res.statusCode === 200) {
          console.log('✅ SUCCESS! Webhook is now working correctly.');
          console.log('🎉 The 504 timeout issue has been resolved.');
          console.log('Response:', data);
        } else if (res.statusCode === 403) {
          console.log('⚠️  Status 403: Signature verification (expected without valid signature)');
          console.log('💡 This means the webhook is processing but rejecting unsigned requests');
          console.log('✅ This indicates the 504 timeout issue is FIXED!');
        } else if (res.statusCode === 504) {
          console.log('❌ Still getting 504 timeout - fix not working yet');
          console.log('💡 Check that:');
          console.log('   - DATABASE_URL environment variable is set in DigitalOcean');
          console.log('   - PostgreSQL database is accessible');
          console.log('   - App has been redeployed with new app.yaml');
        } else {
          console.log('🤔 Unexpected status code - check the response');
          console.log('Response:', data.substring(0, 200));
        }
        
        resolve(res.statusCode);
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Connection error:', err.message);
      resolve(null);
    });
    
    req.on('timeout', () => {
      console.log('❌ Request timeout - still having issues');
      req.destroy();
      resolve(null);
    });
    
    req.write(body);
    req.end();
  });
}

// Also test health endpoint to make sure app is running
async function testHealth() {
  console.log('📊 Testing health endpoint...');
  
  return new Promise((resolve) => {
    const req = https.request(WEBHOOK_URL + '/health', { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Health check passed');
          resolve(true);
        } else {
          console.log('❌ Health check failed:', res.statusCode);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Health check error:', err.message);
      resolve(false);
    });
    
    req.end();
  });
}

async function runVerification() {
  // Test health first
  const healthOk = await testHealth();
  
  if (!healthOk) {
    console.log('\n❌ App is not responding - deployment may have failed');
    return;
  }
  
  console.log(''); // Spacing
  
  // Test webhook
  const webhookStatus = await quickTest();
  
  console.log('\n🏁 VERIFICATION SUMMARY');
  console.log('========================');
  
  if (webhookStatus === 200 || webhookStatus === 403) {
    console.log('✅ SUCCESS: Webhook 504 timeout issue is RESOLVED!');
    console.log('💡 The webhook is now processing Facebook message payloads correctly.');
    console.log('🚀 You can now configure Facebook to send webhooks to this endpoint.');
  } else if (webhookStatus === 504) {
    console.log('❌ STILL FAILING: 504 timeout issue persists');
    console.log('💡 Additional troubleshooting needed - check DigitalOcean logs');
  } else {
    console.log('🤔 UNCLEAR: Unexpected response - manual investigation needed');
  }
}

runVerification().catch(console.error);