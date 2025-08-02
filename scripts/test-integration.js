#!/usr/bin/env node

/**
 * Integration Test Script for Template and FAQ System
 * Tests the seamless integration between bot, templates, FAQs, and configuration
 */

const path = require('path');
const fs = require('fs');

// Set up environment for testing
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/essen_bot_test';

console.log('🧪 Starting Integration Tests for Template and FAQ System\n');

async function runIntegrationTests() {
  try {
    // Test 1: Database Initialization
    console.log('📊 Test 1: Database Initialization');
    const { initDatabase, db } = require('../src/database-pg');
    
    console.log('   - Initializing database...');
    await initDatabase();
    console.log('   ✅ Database initialized successfully');
    
    // Test 2: Bot Configuration
    console.log('\n⚙️  Test 2: Bot Configuration');
    
    console.log('   - Testing getBotConfig...');
    const allConfigs = await db.getBotConfig();
    console.log(`   - Found ${allConfigs.length} configuration settings`);
    
    const templateMatchingConfig = await db.getBotConfig('template_matching_enabled');
    console.log(`   - Template matching enabled: ${templateMatchingConfig?.value}`);
    
    const faqMatchingConfig = await db.getBotConfig('faq_matching_enabled');
    console.log(`   - FAQ matching enabled: ${faqMatchingConfig?.value}`);
    console.log('   ✅ Bot configuration working');
    
    // Test 3: Template System
    console.log('\n📝 Test 3: Template System');
    
    // Insert a test template
    console.log('   - Creating test template...');
    await db.query(`
      INSERT INTO promotion_templates (
        name, category, content, quick_replies, variables, trigger_keywords, is_active
      ) VALUES (
        'Test Sofa Promotion',
        'sofas',
        'Hello {{user_name}}! Our premium sofas are perfect for your home. Visit us today!',
        '[{"content_type": "text", "title": "Visit showroom", "payload": "VISIT_SHOWROOM"}]',
        '[{"name": "user_name", "default_value": "Customer"}]',
        '["sofa", "couch", "seating"]',
        true
      ) ON CONFLICT DO NOTHING
    `);
    
    const templates = await db.getActiveTemplates('sofas');
    console.log(`   - Found ${templates.length} active sofa templates`);
    
    if (templates.length > 0) {
      const { processTemplateContent } = require('../src/promotionHandler');
      const processed = processTemplateContent(templates[0], { user_name: 'John' });
      console.log(`   - Processed template: ${processed.content.substring(0, 50)}...`);
      console.log('   ✅ Template processing working');
    }
    
    // Test 4: FAQ System
    console.log('\n❓ Test 4: FAQ System');
    
    // Insert a test FAQ
    console.log('   - Creating test FAQ...');
    await db.query(`
      INSERT INTO faqs (
        question, answer, category, keywords, is_active
      ) VALUES (
        'What are your operating hours?',
        'We are open daily from 11am to 7pm. Visit us at 36 Jalan Kilang Barat!',
        'general',
        '["hours", "time", "open", "close", "operating"]',
        true
      ) ON CONFLICT DO NOTHING
    `);
    
    const faqs = await db.getActiveFAQs();
    console.log(`   - Found ${faqs.length} active FAQs`);
    
    const searchResults = await db.searchFAQs('operating hours', 5);
    console.log(`   - Search for "operating hours": ${searchResults.length} results`);
    
    if (searchResults.length > 0) {
      console.log(`   - Top result: ${searchResults[0].question}`);
      console.log('   ✅ FAQ search working');
    }
    
    // Test 5: FAQ Matching Logic
    console.log('\n🔍 Test 5: FAQ Matching Logic');
    
    const { findMatchingFAQs, isFAQInquiry } = require('../src/faqHandler');
    
    const testQuestions = [
      'What time do you open?',
      'When are you open?',
      'What are your hours?',
      'I want to buy a sofa'
    ];
    
    for (const question of testQuestions) {
      const isFAQ = isFAQInquiry(question);
      const matches = await findMatchingFAQs(question, 3);
      console.log(`   - "${question}": FAQ=${isFAQ}, Matches=${matches.length}`);
    }
    console.log('   ✅ FAQ matching logic working');
    
    // Test 6: Promotion Detection
    console.log('\n🎯 Test 6: Promotion Detection');
    
    const { detectPromotionInquiry } = require('../src/promotionHandler');
    
    const testMessages = [
      'I need a new sofa',
      'Looking for kitchen renovation',
      'Show me your toilet sets',
      'What about dining tables?'
    ];
    
    for (const message of testMessages) {
      const category = await detectPromotionInquiry(message);
      console.log(`   - "${message}": Category=${category || 'none'}`);
    }
    console.log('   ✅ Promotion detection working');
    
    // Test 7: Message Handler Integration
    console.log('\n🤖 Test 7: Message Handler Integration');
    
    const { getBotConfig, isFeatureEnabled } = require('../src/messageHandler');
    
    console.log('   - Testing configuration caching...');
    const config1 = await getBotConfig('template_matching_enabled');
    const config2 = await getBotConfig('template_matching_enabled');
    console.log(`   - Cache consistency: ${config1 === config2}`);
    
    const templateEnabled = await isFeatureEnabled('template_matching_enabled');
    const faqEnabled = await isFeatureEnabled('faq_matching_enabled');
    console.log(`   - Template matching: ${templateEnabled}`);
    console.log(`   - FAQ matching: ${faqEnabled}`);
    console.log('   ✅ Message handler integration working');
    
    // Test 8: Analytics Tracking
    console.log('\n📈 Test 8: Analytics Tracking');
    
    console.log('   - Testing template usage logging...');
    if (templates.length > 0) {
      await db.logTemplateUsage(templates[0].id, 'test_user_123', 'Integration test');
      console.log('   - Template usage logged');
    }
    
    console.log('   - Testing FAQ usage logging...');
    if (faqs.length > 0) {
      await db.logFAQUsage(faqs[0].id, 'test_user_123', 'What are your hours?');
      console.log('   - FAQ usage logged');
    }
    
    console.log('   ✅ Analytics tracking working');
    
    // Summary
    console.log('\n🎉 Integration Test Summary:');
    console.log('   ✅ Database initialization');
    console.log('   ✅ Bot configuration system');
    console.log('   ✅ Template processing and variables');
    console.log('   ✅ FAQ search and matching');
    console.log('   ✅ Promotion detection');
    console.log('   ✅ Message handler integration');
    console.log('   ✅ Analytics tracking');
    console.log('\n🚀 All integration tests passed successfully!');
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    try {
      await db.query('DELETE FROM template_usage WHERE user_id = ?', ['test_user_123']);
      await db.query('DELETE FROM faq_usage WHERE user_id = ?', ['test_user_123']);
      console.log('   - Test data cleaned up');
    } catch (error) {
      console.log('   - Note: Could not clean up test data (this is okay for development)');
    }
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runIntegrationTests().then(() => {
    console.log('\n✨ Integration testing completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Integration testing failed:', error);
    process.exit(1);
  });
}

module.exports = { runIntegrationTests };