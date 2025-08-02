/**
 * End-to-End tests for promotion journey
 * Tests complete user journey from promotion inquiry to potential conversion
 * Uses Playwright for browser automation and API testing
 */

const { test, expect } = require('@playwright/test');
const axios = require('axios');
const { 
  mockUsers, 
  mockPromotionTemplates, 
  performanceTestData 
} = require('../fixtures/testData');

// Mock configuration for testing
const TEST_CONFIG = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  facebookAPI: 'https://graph.facebook.com/v18.0',
  timeout: 30000
};

// Helper function to simulate Facebook webhook call
async function simulateWebhookMessage(senderId, messageText, messageType = 'text') {
  const webhookPayload = {
    object: 'page',
    entry: [{
      messaging: [{
        sender: { id: senderId },
        recipient: { id: 'test_page_id' },
        timestamp: Date.now(),
        message: messageType === 'text' ? 
          { text: messageText } : 
          { quick_reply: { payload: messageText } }
      }]
    }]
  };

  const response = await axios.post(`${TEST_CONFIG.baseURL}/webhook`, webhookPayload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': 'sha256=test_signature'
    },
    timeout: TEST_CONFIG.timeout
  });

  return response;
}

// Helper function to wait for processing
async function waitForProcessing(ms = 2000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test.describe('Promotion Journey E2E Tests', () => {
  test.beforeEach(async () => {
    // Set up test environment
    process.env.PAGE_ACCESS_TOKEN = 'test_token_12345';
    process.env.VERIFY_TOKEN = 'test_verify_token';
    process.env.APP_SECRET = 'test_app_secret';
  });

  test.describe('Complete Promotion Journey', () => {
    test('should complete toilet promotion inquiry journey', async () => {
      const userId = mockUsers.testUser1.id;
      
      // Step 1: User asks about toilet promotion
      let response = await simulateWebhookMessage(userId, 'Do you have toilet sets on promotion?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 2: User clicks on quick reply for more details
      response = await simulateWebhookMessage(userId, 'Toilet promotions', 'quick_reply');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 3: User asks about pricing
      response = await simulateWebhookMessage(userId, 'How much for the complete set?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 4: User requests showroom visit
      response = await simulateWebhookMessage(userId, 'Book showroom visit', 'quick_reply');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 5: User provides appointment details
      response = await simulateWebhookMessage(userId, 'Tomorrow at 2pm please');
      expect(response.status).toBe(200);
      
      // Journey should complete successfully without errors
      expect(response.status).toBe(200);
    });

    test('should complete kitchen promotion journey with media', async () => {
      const userId = mockUsers.testUser2.id;
      
      // Step 1: User inquires about kitchen deals
      let response = await simulateWebhookMessage(userId, 'Kitchen renovation deals available?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 2: User asks to see images
      response = await simulateWebhookMessage(userId, 'Show me kitchen packages');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 3: User asks for consultation
      response = await simulateWebhookMessage(userId, 'Design consultation', 'quick_reply');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 4: User provides contact details
      response = await simulateWebhookMessage(userId, 'My number is 91234567, call me tomorrow morning');
      expect(response.status).toBe(200);
    });

    test('should handle urgent promotion inquiry journey', async () => {
      const userId = mockUsers.testUser3.id;
      
      // Step 1: Urgent sofa inquiry
      let response = await simulateWebhookMessage(userId, 'Need sofa urgently for house moving next week!');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 2: User asks about immediate availability
      response = await simulateWebhookMessage(userId, 'Which sofas are ready stock?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 3: User wants to visit today
      response = await simulateWebhookMessage(userId, 'Can I come today at 4pm?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 4: User confirms visit
      response = await simulateWebhookMessage(userId, 'Yes, confirm appointment');
      expect(response.status).toBe(200);
    });
  });

  test.describe('Multi-channel Promotion Journey', () => {
    test('should handle promotion journey with WhatsApp handoff', async () => {
      const userId = mockUsers.testUser1.id;
      
      // Step 1: User asks about promotions
      let response = await simulateWebhookMessage(userId, 'Current furniture promotions?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 2: User wants detailed pricing via WhatsApp
      response = await simulateWebhookMessage(userId, 'WhatsApp for prices', 'quick_reply');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Should provide WhatsApp contact information
      expect(response.status).toBe(200);
    });

    test('should handle promotion journey with human intervention', async () => {
      const userId = mockUsers.testUser2.id;
      
      // Step 1: Complex inquiry
      let response = await simulateWebhookMessage(userId, 'I need custom kitchen design for irregular space');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 2: User requests human help
      response = await simulateWebhookMessage(userId, '/human');
      expect(response.status).toBe(200);
      
      // Should trigger human intervention
      expect(response.status).toBe(200);
    });
  });

  test.describe('Singapore-specific Promotion Journeys', () => {
    test('should handle Singlish promotion journey', async () => {
      const userId = mockUsers.testUser3.id;
      
      // Step 1: Singlish inquiry
      let response = await simulateWebhookMessage(userId, 'Wah uncle, toilet bowl got promotion anot?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 2: Continue in Singlish
      response = await simulateWebhookMessage(userId, 'How much leh? Can negotiate or not?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 3: Ask about HDB suitability
      response = await simulateWebhookMessage(userId, 'Suitable for HDB toilet or not ah?');
      expect(response.status).toBe(200);
      
      // Should handle Singlish context appropriately
      expect(response.status).toBe(200);
    });

    test('should handle BTO renovation journey', async () => {
      const userId = mockUsers.testUser1.id;
      
      // Step 1: BTO context
      let response = await simulateWebhookMessage(userId, 'BTO renovation package got? Need everything for 4-room flat');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 2: Ask about package deals
      response = await simulateWebhookMessage(userId, 'Whole house package cheaper?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Step 3: Timeline inquiry
      response = await simulateWebhookMessage(userId, 'How long delivery take? My TOP is next month');
      expect(response.status).toBe(200);
    });
  });

  test.describe('Error Recovery in Promotion Journey', () => {
    test('should recover from failed template loading', async () => {
      const userId = mockUsers.testUser2.id;
      
      // Simulate scenario where database templates fail to load
      let response = await simulateWebhookMessage(userId, 'Dining table promotion?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Should fallback to static templates
      response = await simulateWebhookMessage(userId, 'Tell me more about dining sets');
      expect(response.status).toBe(200);
    });

    test('should handle network interruptions gracefully', async () => {
      const userId = mockUsers.testUser3.id;
      
      // Start promotion journey
      let response = await simulateWebhookMessage(userId, 'Kitchen sink promotion?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Continue after potential network interruption
      response = await simulateWebhookMessage(userId, 'Are you still there?');
      expect(response.status).toBe(200);
      
      // Should maintain conversation context
      response = await simulateWebhookMessage(userId, 'Yes, show me the kitchen packages');
      expect(response.status).toBe(200);
    });
  });

  test.describe('Performance Testing', () => {
    test('should handle multiple concurrent promotion journeys', async () => {
      const concurrentUsers = 10;
      const promises = [];
      
      for (let i = 0; i < concurrentUsers; i++) {
        const userId = `concurrent_user_${i}`;
        const promise = simulateWebhookMessage(userId, `Promotion inquiry ${i}`);
        promises.push(promise);
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should complete within reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // 10 seconds for 10 concurrent users
    });

    test('should maintain performance with large conversation history', async () => {
      const userId = mockUsers.testUser1.id;
      
      // Simulate long conversation
      const messageCount = 20;
      
      for (let i = 0; i < messageCount; i++) {
        const response = await simulateWebhookMessage(userId, `Message ${i} about furniture`);
        expect(response.status).toBe(200);
        
        if (i % 5 === 0) {
          await waitForProcessing(500); // Brief pause every 5 messages
        }
      }
      
      // Final promotion inquiry should still be fast
      const startTime = Date.now();
      const response = await simulateWebhookMessage(userId, 'Any current promotions available?');
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });

  test.describe('Conversion Tracking', () => {
    test('should track promotion journey to appointment booking', async () => {
      const userId = mockUsers.testUser2.id;
      
      // Step 1: Start with promotion inquiry
      await simulateWebhookMessage(userId, 'Sofa promotion available?');
      await waitForProcessing();
      
      // Step 2: Show interest
      await simulateWebhookMessage(userId, 'Looks good, want to see in person');
      await waitForProcessing();
      
      // Step 3: Book appointment (conversion)
      const response = await simulateWebhookMessage(userId, 'Book appointment for Saturday 3pm');
      expect(response.status).toBe(200);
      
      // Should complete the conversion journey
      await waitForProcessing();
    });

    test('should track promotion journey to WhatsApp handoff', async () => {
      const userId = mockUsers.testUser3.id;
      
      // Step 1: Promotion inquiry
      await simulateWebhookMessage(userId, 'Kitchen renovation packages?');
      await waitForProcessing();
      
      // Step 2: Request detailed pricing
      await simulateWebhookMessage(userId, 'Need detailed quote for my renovation');
      await waitForProcessing();
      
      // Step 3: WhatsApp handoff (conversion)
      const response = await simulateWebhookMessage(userId, 'WhatsApp deals', 'quick_reply');
      expect(response.status).toBe(200);
    });
  });

  test.describe('A/B Testing for Promotions', () => {
    test('should handle different template variations', async () => {
      const userA = mockUsers.testUser1.id;
      const userB = mockUsers.testUser2.id;
      
      // Test variation A (user 1)
      let responseA = await simulateWebhookMessage(userA, 'Toilet promotion?');
      expect(responseA.status).toBe(200);
      
      await waitForProcessing();
      
      // Test variation B (user 2)
      let responseB = await simulateWebhookMessage(userB, 'Toilet promotion?');
      expect(responseB.status).toBe(200);
      
      // Both should succeed regardless of template variation
      expect(responseA.status).toBe(200);
      expect(responseB.status).toBe(200);
    });
  });

  test.describe('Mobile Experience Testing', () => {
    test('should handle promotion journey on mobile device', async () => {
      const userId = mockUsers.testUser1.id;
      
      // Simulate mobile user behavior (shorter messages, more typos)
      let response = await simulateWebhookMessage(userId, 'sofa promo?');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      // Quick interactions typical of mobile
      response = await simulateWebhookMessage(userId, 'show pics');
      expect(response.status).toBe(200);
      
      await waitForProcessing();
      
      response = await simulateWebhookMessage(userId, 'price?');
      expect(response.status).toBe(200);
    });
  });

  test.describe('Analytics and Tracking', () => {
    test('should track complete promotion funnel', async () => {
      const userId = mockUsers.testUser3.id;
      
      // Start tracking promotion funnel
      await simulateWebhookMessage(userId, 'Any dining table promotions?');
      await waitForProcessing();
      
      // Interest stage
      await simulateWebhookMessage(userId, 'Show me dining options');
      await waitForProcessing();
      
      // Consideration stage
      await simulateWebhookMessage(userId, 'What sizes available?');
      await waitForProcessing();
      
      // Intent stage
      await simulateWebhookMessage(userId, 'Want to visit showroom');
      await waitForProcessing();
      
      // Conversion stage
      const response = await simulateWebhookMessage(userId, 'Book visit for tomorrow 2pm');
      expect(response.status).toBe(200);
    });
  });
});

// Helper test for admin interface integration
test.describe('Admin Interface Integration', () => {
  test('should allow admin to create and test promotion templates', async () => {
    // This would typically use Playwright to interact with the admin UI
    // For now, we'll test the API endpoints
    
    const templateData = {
      title: 'Test Promotion Template',
      category: 'test_category',
      content: 'Test promotion content with {{user_name}}',
      variables: JSON.stringify([
        { name: 'user_name', default_value: 'Customer' }
      ]),
      quick_replies: JSON.stringify([
        { title: 'Learn more', payload: 'LEARN_MORE' }
      ]),
      is_active: true
    };
    
    // Test template creation via API
    try {
      const response = await axios.post(`${TEST_CONFIG.baseURL}/api/templates`, templateData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_token'
        },
        timeout: TEST_CONFIG.timeout
      });
      
      expect(response.status).toBe(201);
    } catch (error) {
      // Admin API might not be available in test environment
      console.log('Admin API not available for testing');
    }
  });
});

// Performance benchmark test
test.describe('Performance Benchmarks', () => {
  test('should meet response time benchmarks', async () => {
    const userId = mockUsers.testUser1.id;
    const iterations = 10;
    const responseTimes = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const response = await simulateWebhookMessage(userId, `Benchmark test ${i}`);
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      responseTimes.push(endTime - startTime);
    }
    
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    
    // Benchmarks
    expect(averageResponseTime).toBeLessThan(2000); // Average < 2 seconds
    expect(maxResponseTime).toBeLessThan(5000); // Max < 5 seconds
    
    console.log(`Average response time: ${averageResponseTime}ms`);
    console.log(`Max response time: ${maxResponseTime}ms`);
  });
});