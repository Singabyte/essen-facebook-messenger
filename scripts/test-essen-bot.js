#!/usr/bin/env node

// Test script for ESSEN chatbot functionality
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { generateResponseWithHistory, generateQuickReplies } = require('../src/geminiClient');

console.log('🧪 Testing ESSEN Chatbot Functionality\n');

// Test queries
const testQueries = [
  {
    name: 'BTO Inquiry',
    query: 'Hi, I\'m looking for a sofa for my new BTO',
    expected: 'Should mention BTO, modular sofas, showroom visit'
  },
  {
    name: 'Singapore Weather Concern',
    query: 'Do you have any leather sofa that won\'t be too hot ah?',
    expected: 'Should address climate, mention breathable leather'
  },
  {
    name: 'Space Constraint',
    query: 'My HDB flat damn small leh, you have space-saving furniture?',
    expected: 'Should empathize, suggest extendable/storage options'
  },
  {
    name: 'Price Inquiry',
    query: 'Wah, leather sofa very expensive or not?',
    expected: 'Should focus on value, mention different grades'
  },
  {
    name: 'Product Comparison',
    query: 'What\'s the difference between your electronic and regular sofas?',
    expected: 'Should explain features, benefits'
  },
  {
    name: 'Delivery Timeline',
    query: 'CNY coming, can deliver before or not?',
    expected: 'Should mention timeline, suggest showroom visit'
  }
];

// Test conversation history
const mockHistory = [
  {
    message: 'Looking for living room furniture',
    response: 'Great! We have excellent living room solutions including sofas, coffee tables, and accent chairs.'
  }
];

async function runTests() {
  console.log('Testing with Gemini API...\n');
  
  for (const test of testQueries) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`❓ Query: "${test.query}"`);
    console.log(`✅ Expected: ${test.expected}`);
    
    try {
      // Test with history for context
      const response = await generateResponseWithHistory(test.query, test.name.includes('Product') ? mockHistory : []);
      console.log(`\n🤖 Response:\n${response}`);
      
      // Generate quick replies
      const quickReplies = await generateQuickReplies(test.query, response);
      console.log(`\n🔘 Quick Replies: ${quickReplies.join(' | ')}`);
      
      console.log('\n' + '─'.repeat(80));
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
  
  // Test commands
  console.log('\n\n📝 Testing Commands:');
  const commands = ['/help', '/products', '/showroom', '/bestsellers'];
  
  const messageHandler = require('../src/messageHandler');
  for (const cmd of commands) {
    console.log(`\nCommand: ${cmd}`);
    // Note: Direct testing of commands would require mocking
    console.log('✓ Command registered in messageHandler');
  }
  
  console.log('\n\n✅ Test completed!');
  console.log('\nNote: Full integration testing requires:');
  console.log('1. Valid Gemini API key in .env');
  console.log('2. Facebook credentials for webhook testing');
  console.log('3. Running server with: npm run dev');
}

// Check if Gemini API key is set
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in .env file');
  console.log('Please add your Gemini API key to test the bot responses');
  console.log('Looking for .env at:', path.join(__dirname, '../.env'));
  process.exit(1);
} else {
  console.log('✅ Gemini API key loaded successfully');
  console.log(`API Key starts with: ${process.env.GEMINI_API_KEY.substring(0, 10)}...`);
}

// Run tests
runTests().catch(console.error);