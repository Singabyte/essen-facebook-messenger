const https = require('https');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://essen-messenger-bot-zxxtw.ondigitalocean.app/webhook';
const APP_SECRET = process.env.APP_SECRET;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

console.log('Testing webhook at:', WEBHOOK_URL);
console.log('Using APP_SECRET:', APP_SECRET ? APP_SECRET.substring(0, 10) + '...' : 'NOT SET');

// Test 1: Webhook Verification (GET request)
function testWebhookVerification() {
  console.log('\n📍 Testing webhook verification...');
  
  const verifyUrl = new URL(WEBHOOK_URL);
  verifyUrl.searchParams.append('hub.mode', 'subscribe');
  verifyUrl.searchParams.append('hub.verify_token', VERIFY_TOKEN);
  verifyUrl.searchParams.append('hub.challenge', 'test_challenge_123');
  
  https.get(verifyUrl.toString(), (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      
      if (res.statusCode === 200 && data === 'test_challenge_123') {
        console.log('✅ Webhook verification PASSED');
      } else {
        console.log('❌ Webhook verification FAILED');
        if (res.statusCode === 404) {
          console.log('   → Make sure webhook URL includes /webhook path');
        }
      }
      
      // Proceed to test message handling
      setTimeout(testWebhookMessage, 1000);
    });
  }).on('error', (err) => {
    console.error('❌ Error:', err);
  });
}

// Test 2: Webhook Message Handling (POST request)
function testWebhookMessage() {
  console.log('\n📨 Testing webhook message handling...');
  
  const testPayload = {
    object: 'page',
    entry: [{
      id: '123456789',
      time: Date.now(),
      messaging: [{
        sender: { id: 'test_user_123' },
        recipient: { id: 'test_page_456' },
        timestamp: Date.now(),
        message: {
          mid: 'test_message_id',
          text: 'Test message from webhook test'
        }
      }]
    }]
  };
  
  const payloadString = JSON.stringify(testPayload);
  
  // Calculate signature
  const signature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(payloadString)
    .digest('hex');
  
  const url = new URL(WEBHOOK_URL);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadString),
      'X-Hub-Signature-256': `sha256=${signature}`
    }
  };
  
  console.log('Signature:', options.headers['X-Hub-Signature-256']);
  
  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      
      if (res.statusCode === 200) {
        console.log('✅ Webhook message handling PASSED');
      } else if (res.statusCode === 403) {
        console.log('❌ Webhook signature verification FAILED');
        console.log('   → Check APP_SECRET is correct');
      } else if (res.statusCode === 404) {
        console.log('❌ Webhook endpoint not found');
        console.log('   → Check webhook URL path');
      } else {
        console.log('❌ Unexpected response');
      }
    });
  });
  
  req.on('error', (err) => {
    console.error('❌ Error:', err);
  });
  
  req.write(payloadString);
  req.end();
}

// Test 3: Test local webhook if URL is localhost
function testLocal() {
  if (WEBHOOK_URL.includes('localhost')) {
    console.log('\n🏠 Testing local webhook...');
    const http = require('http');
    
    // Test health endpoint first
    http.get('http://localhost:3000/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Local server is running');
          testWebhookVerification();
        } else {
          console.log('❌ Local server not responding');
          console.log('   → Start server with: npm start');
        }
      });
    }).on('error', () => {
      console.log('❌ Cannot connect to local server');
      console.log('   → Start server with: npm start');
    });
  } else {
    testWebhookVerification();
  }
}

// Start tests
console.log('🧪 Facebook Webhook Test Script');
console.log('================================');

if (!APP_SECRET) {
  console.error('❌ APP_SECRET not found in .env file');
  console.error('   → Add APP_SECRET to your .env file');
  process.exit(1);
}

if (!VERIFY_TOKEN) {
  console.error('❌ VERIFY_TOKEN not found in .env file');
  console.error('   → Add VERIFY_TOKEN to your .env file');
  process.exit(1);
}

// Run tests
testLocal();