#!/usr/bin/env node

/**
 * Initialize Facebook Messenger profile settings
 * This sets up greeting, get started button, and persistent menu
 */

require('dotenv').config();
const { initializeFacebookFeatures } = require('../src/facebook-integration');

console.log('🚀 Initializing Facebook Messenger features...\n');

initializeFacebookFeatures()
  .then(() => {
    console.log('\n✅ Facebook Messenger features initialized successfully!');
    console.log('Your bot now has:');
    console.log('  • A welcome greeting message');
    console.log('  • A "Get Started" button');
    console.log('  • A persistent menu with quick access options');
    console.log('\nUsers can now interact with your bot on Facebook Messenger!');
  })
  .catch(error => {
    console.error('\n❌ Failed to initialize Facebook features:');
    console.error(error.message);
    
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      console.error(`\nFacebook API Error:`);
      console.error(`  Message: ${fbError.message}`);
      console.error(`  Type: ${fbError.type}`);
      console.error(`  Code: ${fbError.code}`);
    }
    
    console.error('\nTroubleshooting tips:');
    console.error('1. Verify your PAGE_ACCESS_TOKEN is correct');
    console.error('2. Ensure your Facebook app has the necessary permissions');
    console.error('3. Check if your app is in development or live mode');
    console.error('4. Run scripts/test-facebook-api.js to diagnose the issue');
  });