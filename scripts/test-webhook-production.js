const https = require('https');
const crypto = require('crypto');

// Test webhook with proper signature
const APP_SECRET = process.env.APP_SECRET || 'your-app-secret-here';
const WEBHOOK_URL = 'https://essen-messenger-bot-zxxtw.ondigitalocean.app/webhook';

const testPayload = {
  object: 'page',
  entry: [{
    id: '123456789',
    time: Date.now(),
    messaging: [{
      sender: { id: 'test-user-id' },
      recipient: { id: 'page-id' },
      timestamp: Date.now(),
      message: {
        mid: 'test-message-id',
        text: 'Test message from production test script'
      }
    }]
  }]
};

const body = JSON.stringify(testPayload);
const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': body.length,
    'X-Hub-Signature-256': signature
  }
};

console.log('Testing webhook at:', WEBHOOK_URL);
console.log('Using APP_SECRET:', APP_SECRET.substring(0, 10) + '...');
console.log('Signature:', signature);

const req = https.request(WEBHOOK_URL, options, (res) => {
  console.log('Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
    
    if (res.statusCode === 200) {
      console.log('✅ Webhook accepted the request!');
      console.log('Check your logs for "Webhook POST received"');
    } else if (res.statusCode === 403) {
      console.log('❌ Webhook rejected - signature verification failed');
      console.log('Make sure APP_SECRET matches exactly');
    } else {
      console.log('❌ Unexpected response');
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
});

req.write(body);
req.end();