#!/usr/bin/env node

/**
 * Test script for message batching functionality
 * This simulates multiple messages from a user within 60 seconds
 */

require('dotenv').config();
const messageHandler = require('../src/messageHandler');

// Simulate webhook events
function createMessageEvent(senderId, text) {
  return {
    sender: { id: senderId },
    recipient: { id: 'page_id' },
    message: {
      mid: `mid_${Date.now()}_${Math.random()}`,
      text: text
    }
  };
}

async function testBatching() {
  console.log('Testing message batching functionality...\n');
  
  const testUserId = 'test_user_123';
  
  // Simulate user sending multiple messages quickly
  const messages = [
    "Hi there",
    "I'm looking for a sofa",
    "Something modern",
    "Budget around $2000",
    "Need delivery to Tampines"
  ];
  
  console.log('Simulating user sending multiple messages:');
  
  for (let i = 0; i < messages.length; i++) {
    const event = createMessageEvent(testUserId, messages[i]);
    console.log(`[${i+1}] Sending: "${messages[i]}"`);
    
    // Call handleMessage without await to simulate rapid messages
    messageHandler.handleMessage(event).catch(err => {
      console.error('Error handling message:', err);
    });
    
    // Small delay between messages (simulating typing speed)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\nAll messages sent. Waiting for batch to process...');
  console.log('(Should process after 60 seconds from first message)\n');
  
  // Wait for batch timeout plus some buffer
  setTimeout(() => {
    console.log('\nTest complete. Check logs above for batch processing.');
    process.exit(0);
  }, 65000);
}

// Run test
testBatching().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});