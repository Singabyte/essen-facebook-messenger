#!/usr/bin/env node

/**
 * Test sending a message directly to Facebook
 * Usage: node test-send-message.js <recipient_id> [message]
 */

require('dotenv').config();
const axios = require('axios');

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

const recipientId = process.argv[2];
const message = process.argv[3] || 'Test message from ESSEN Bot - If you receive this, the bot is working!';

if (!recipientId) {
  console.error('Usage: node test-send-message.js <recipient_id> [message]');
  console.error('Example: node test-send-message.js 123456789 "Hello from bot"');
  process.exit(1);
}

if (!PAGE_ACCESS_TOKEN) {
  console.error('PAGE_ACCESS_TOKEN not found in environment');
  process.exit(1);
}

console.log('Sending message to recipient:', recipientId);
console.log('Message:', message);
console.log('Token length:', PAGE_ACCESS_TOKEN.length);

// Send the message
async function sendMessage() {
  try {
    const response = await axios({
      method: 'post',
      url: `${FACEBOOK_API_URL}/me/messages`,
      params: {
        access_token: PAGE_ACCESS_TOKEN
      },
      data: {
        recipient: {
          id: recipientId
        },
        message: {
          text: message
        }
      }
    });

    console.log('\n✅ Message sent successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Failed to send message');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      const fbError = error.response.data.error;
      if (fbError) {
        console.error('\nFacebook Error Details:');
        console.error('  Code:', fbError.code);
        console.error('  Type:', fbError.type);
        console.error('  Message:', fbError.message);
        
        // Common error explanations
        if (fbError.code === 10) {
          console.error('\n⚠️  This error means one of the following:');
          console.error('  1. The recipient hasn\'t messaged your page first');
          console.error('  2. The recipient ID is incorrect');
          console.error('  3. The app doesn\'t have permission to message this user');
          console.error('  4. The conversation window has expired (24 hours)');
        } else if (fbError.code === 230) {
          console.error('\n⚠️  The user has blocked messages from your page');
        } else if (fbError.code === 190) {
          console.error('\n⚠️  The access token is invalid or expired');
        }
      }
    } else {
      console.error('Error:', error.message);
    }
  }
}

sendMessage();