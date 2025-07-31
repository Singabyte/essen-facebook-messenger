#!/usr/bin/env node

/**
 * Comprehensive production test for Facebook webhook
 * Tests all aspects to identify the 504 timeout root cause
 */

const https = require('https');
const crypto = require('crypto');

const WEBHOOK_URL = 'https://essen-messenger-bot-zxxtw.ondigitalocean.app';

// Test functions
async function testEndpoint(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 30000
    };

    if (data && method === 'POST') {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = body.length;
    }

    console.log(`\n🔍 Testing ${method} ${path}...`);
    
    const req = https.request(WEBHOOK_URL + path, options, (res) => {
      const duration = Date.now() - start;
      let responseData = '';
      
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        const result = {
          status: res.statusCode,
          duration,
          data: responseData,
          headers: res.headers
        };
        
        console.log(`   Status: ${res.statusCode} (${duration}ms)`);
        
        if (res.statusCode >= 400) {
          console.log(`   Error: ${responseData.substring(0, 100)}`);
        } else {
          console.log(`   Success: ${responseData.substring(0, 100)}${responseData.length > 100 ? '...' : ''}`);
        }
        
        resolve(result);
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ Connection error: ${err.message}`);
      reject(err);
    });
    
    req.on('timeout', () => {
      console.log(`   ❌ Request timeout after 30s`);
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    if (data && method === 'POST') {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testFacebookWebhook() {
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
          text: 'Test message for production webhook'
        }
      }]
    }]
  };

  try {
    // Test without signature first (should get 403)
    const result1 = await testEndpoint('/', 'POST', testPayload);
    
    // Test with invalid signature (should get 403)
    const fakeSignature = 'sha256=' + crypto.createHmac('sha256', 'fake-secret').update(JSON.stringify(testPayload)).digest('hex');
    const result2 = await testEndpoint('/', 'POST', testPayload, {
      'X-Hub-Signature-256': fakeSignature
    });
    
    return { result1, result2 };
  } catch (error) {
    return { error: error.message };
  }
}

async function runComprehensiveTest() {
  console.log('🚀 COMPREHENSIVE PRODUCTION WEBHOOK TEST');
  console.log('=========================================');
  
  try {
    // 1. Basic connectivity test
    console.log('\n📡 Phase 1: Basic Connectivity');
    const healthResult = await testEndpoint('/health');
    
    // 2. App info test
    console.log('\n📊 Phase 2: App Information');
    const versionResult = await testEndpoint('/debug/version');
    
    // 3. Root GET test (should return bot status)
    console.log('\n🏠 Phase 3: Root Path Test');
    const rootResult = await testEndpoint('/');
    
    // 4. Test non-existent endpoint
    console.log('\n❓ Phase 4: 404 Test');
    const notFoundResult = await testEndpoint('/nonexistent-endpoint');
    
    // 5. Facebook webhook tests
    console.log('\n📱 Phase 5: Facebook Webhook Tests');
    const webhookResults = await testFacebookWebhook();
    
    // 6. Analysis
    console.log('\n🔬 ANALYSIS');
    console.log('===========');
    
    // Check if app is responding
    if (healthResult.status === 200) {
      console.log('✅ App is running and healthy');
    } else {
      console.log('❌ App health check failed');
    }
    
    // Check routing
    if (versionResult.status === 200) {
      console.log('✅ Express routing is working');
      try {
        const versionData = JSON.parse(versionResult.data);
        console.log(`   Node version: ${versionData.nodeVersion}`);
        console.log(`   Environment: ${versionData.env}`);
        console.log(`   Webhook route exists: ${versionData.webhookRouteExists}`);
        console.log(`   Available routes: ${versionData.routes?.join(', ') || 'none'}`);
      } catch (e) {
        console.log('   Could not parse version data');
      }
    }
    
    // Check webhook routing
    if (rootResult.status === 200) {
      console.log('✅ Root path is responding (webhook router working)');
    } else if (rootResult.status === 404) {
      console.log('❌ Root path returns 404 - webhook router not mounted properly');
    } else if (rootResult.status === 504) {
      console.log('❌ Root path times out - database or initialization issue');
    }
    
    // Check webhook handler
    if (webhookResults.result1?.status === 403) {
      console.log('✅ Webhook handler is processing requests (correctly rejecting unsigned)');
    } else if (webhookResults.result1?.status === 504) {
      console.log('❌ Webhook handler times out - likely database connection issue');
    } else if (webhookResults.result1?.status === 404) {
      console.log('❌ Webhook handler not found - routing issue');
    }
    
    // Final diagnosis
    console.log('\n🏁 DIAGNOSIS');
    console.log('=============');
    
    if (healthResult.status === 200 && rootResult.status === 404) {
      console.log('🔍 ISSUE IDENTIFIED: Webhook router not properly mounted');
      console.log('💡 The Express app is running but the webhook routes are not accessible');
      console.log('📝 This could be due to:');
      console.log('   1. Database initialization blocking the router mounting');
      console.log('   2. Error in the router mounting code in index.js');
      console.log('   3. Middleware interfering with route handling');
    } else if (webhookResults.result1?.status === 504) {
      console.log('🔍 ISSUE IDENTIFIED: Database connection timeout');
      console.log('💡 The webhook handler is accessible but timing out on database operations');
      console.log('📝 Check DATABASE_URL and PostgreSQL connectivity');
    } else if (webhookResults.result1?.status === 403) {
      console.log('✅ WEBHOOK IS WORKING CORRECTLY!');
      console.log('💡 The 504 timeout issue appears to be resolved');
      console.log('🎉 Facebook can now send webhooks to this endpoint');
    } else {
      console.log('🤔 UNCLEAR: Multiple issues or unexpected behavior detected');
      console.log('📝 Manual investigation required');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runComprehensiveTest().catch(console.error);