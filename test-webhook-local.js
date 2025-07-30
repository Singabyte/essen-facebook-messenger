#!/usr/bin/env node

// Test webhook locally before deployment
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'essen_verify_token_12345';

async function testEndpoint(name, method, path, options = {}) {
  try {
    console.log(`\n🧪 Testing ${name}...`);
    const url = `${BASE_URL}${path}`;
    console.log(`${method} ${url}`);
    
    const response = await axios({
      method,
      url,
      ...options,
      validateStatus: () => true // Don't throw on any status
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.data);
    
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🔍 Testing Webhook Endpoints Locally');
  console.log('====================================');
  console.log(`Base URL: ${BASE_URL}`);
  
  // Test 1: Root endpoint
  await testEndpoint('Root endpoint', 'GET', '/');
  
  // Test 2: Health check
  await testEndpoint('Health check', 'GET', '/health');
  
  // Test 3: Webhook verification (valid token)
  await testEndpoint('Webhook verification (valid)', 'GET', '/', {
    params: {
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': 'test123'
    }
  });
  
  // Test 4: Webhook verification (invalid token)
  await testEndpoint('Webhook verification (invalid)', 'GET', '/', {
    params: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong_token',
      'hub.challenge': 'test123'
    }
  });
  
  // Test 5: Webhook test endpoint
  await testEndpoint('Webhook test endpoint', 'GET', '/test');
  
  // Test 6: Debug version
  await testEndpoint('Debug version', 'GET', '/debug/version');
  
  console.log('\n✅ Local tests complete!');
}

// Run tests
runTests().catch(console.error);