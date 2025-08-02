/**
 * Integration tests for complete conversation flows
 * Tests end-to-end conversation scenarios, template integration, and follow-up sequences
 */

const request = require('supertest');
const app = require('../../src/index');
const { 
  mockUsers, 
  mockMessages, 
  mockPromotionTemplates, 
  mockFAQs,
  conversationScenarios 
} = require('../fixtures/testData');

// Mock database module
jest.mock('../../src/database-pg');
const { db } = require('../../src/database-pg');

// Mock Gemini client
jest.mock('../../src/geminiClient');
const { generateResponseWithHistory, generateQuickReplies } = require('../../src/geminiClient');

// Mock Facebook integration
jest.mock('../../src/facebook-integration');
const facebookIntegration = require('../../src/facebook-integration');

// Set up environment variables
process.env.PAGE_ACCESS_TOKEN = 'test_token_12345';
process.env.VERIFY_TOKEN = 'test_verify_token';
process.env.APP_SECRET = 'test_app_secret';

describe('Conversation Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database methods
    db.saveUser = jest.fn().mockResolvedValue();
    db.saveConversation = jest.fn().mockResolvedValue();
    db.getConversationHistory = jest.fn().mockResolvedValue([]);
    db.getUser = jest.fn().mockResolvedValue({ name: 'Test User' });
    db.getUserPreferences = jest.fn().mockResolvedValue({});
    db.logAnalytics = jest.fn().mockResolvedValue();
    db.getBotConfig = jest.fn().mockImplementation((key) => {
      const config = {
        'faq_matching_enabled': { value: '1' },
        'template_matching_enabled': { value: '1' },
        'quick_replies_enabled': { value: '1' },
        'promotion_delay_ms': { value: '5000' }
      };
      return Promise.resolve(config[key] || { value: '1' });
    });
    
    // FAQ methods
    db.searchFAQs = jest.fn().mockResolvedValue([]);
    db.getActiveFAQs = jest.fn().mockResolvedValue(mockFAQs);
    db.getFAQById = jest.fn().mockResolvedValue(mockFAQs[0]);
    db.logFAQUsage = jest.fn().mockResolvedValue();
    
    // Template methods
    db.getActiveTemplates = jest.fn().mockResolvedValue([]);
    db.getTemplatesByKeywords = jest.fn().mockResolvedValue([]);
    db.logTemplateUsage = jest.fn().mockResolvedValue();
    
    // Mock Facebook integration
    Object.keys(facebookIntegration).forEach(key => {
      if (typeof facebookIntegration[key] === 'function') {
        facebookIntegration[key].mockResolvedValue({ message_id: 'test_id' });
      }
    });
    
    // Mock Gemini responses
    generateResponseWithHistory.mockResolvedValue('This is a helpful response about ESSEN furniture.');
    generateQuickReplies.mockResolvedValue(['View products', 'Visit showroom', 'Book consultation']);
  });

  describe('Webhook Message Processing', () => {
    test('should process simple text message successfully', async () => {
      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'Hello' }
          }]
        }]
      };

      const response = await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .set('X-Hub-Signature-256', 'sha256=test_signature')
        .expect(200);

      expect(db.saveUser).toHaveBeenCalled();
      expect(db.saveConversation).toHaveBeenCalled();
      expect(generateResponseWithHistory).toHaveBeenCalled();
    });

    test('should handle promotion inquiry flow', async () => {
      // Mock promotion template response
      db.getActiveTemplates.mockResolvedValue([mockPromotionTemplates[0]]);
      
      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'Do you have toilet sets on promotion?' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(db.getActiveTemplates).toHaveBeenCalledWith('toilet_sets');
      expect(db.logTemplateUsage).toHaveBeenCalled();
      expect(facebookIntegration.sendSplitMessages).toHaveBeenCalled();
      expect(db.logAnalytics).toHaveBeenCalledWith(
        'promotion_served',
        mockUsers.testUser1.id,
        expect.objectContaining({ category: 'toilet_sets' })
      );
    });

    test('should handle FAQ inquiry flow', async () => {
      // Mock FAQ response
      db.searchFAQs.mockResolvedValue([
        { ...mockFAQs[0], relevance_score: 95 }
      ]);
      
      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser2.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'What are your showroom operating hours?' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(db.searchFAQs).toHaveBeenCalled();
      expect(db.logFAQUsage).toHaveBeenCalled();
      expect(facebookIntegration.sendSplitMessages).toHaveBeenCalledWith(
        mockUsers.testUser2.id,
        [mockFAQs[0].answer],
        3000
      );
    });

    test('should handle quick reply responses', async () => {
      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: {
              text: 'View products',
              quick_reply: { payload: 'View products' }
            }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(facebookIntegration.sendMessageWithTyping).toHaveBeenCalled();
    });

    test('should handle postback events', async () => {
      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            postback: { payload: 'GET_STARTED' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(facebookIntegration.sendQuickReply).toHaveBeenCalled();
      expect(db.logAnalytics).toHaveBeenCalledWith(
        'postback_received',
        mockUsers.testUser1.id,
        { payload: 'GET_STARTED' }
      );
    });
  });

  describe('Multi-turn Conversation Flows', () => {
    test('should handle promotion inquiry → follow-up flow', async () => {
      // First message: promotion inquiry
      db.getActiveTemplates.mockResolvedValue([mockPromotionTemplates[0]]);
      
      const promotionInquiry = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'Any toilet promotion?' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(promotionInquiry)
        .expect(200);

      expect(db.logAnalytics).toHaveBeenCalledWith(
        'promotion_served',
        mockUsers.testUser1.id,
        expect.any(Object)
      );

      // Second message: follow-up question
      const followUpMessage = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'What about the pricing?' }
          }]
        }]
      };

      // Mock conversation history
      db.getConversationHistory.mockResolvedValue([
        {
          user_message: 'Any toilet promotion?',
          bot_response: '[Promotion handled: database]',
          timestamp: new Date()
        }
      ]);

      await request(app)
        .post('/webhook')
        .send(followUpMessage)
        .expect(200);

      expect(generateResponseWithHistory).toHaveBeenCalledWith(
        'What about the pricing?',
        expect.any(Array),
        expect.any(Object)
      );
    });

    test('should handle FAQ → related FAQ flow', async () => {
      // First FAQ inquiry
      db.searchFAQs.mockResolvedValue([
        { ...mockFAQs[0], relevance_score: 95 }
      ]);

      const firstFAQ = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser2.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'What are your opening hours?' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(firstFAQ)
        .expect(200);

      // Follow-up FAQ via quick reply
      const faqQuickReply = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser2.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: {
              text: 'Do you provide delivery service?',
              quick_reply: { payload: 'FAQ_2' }
            }
          }]
        }]
      };

      db.getFAQById.mockResolvedValue(mockFAQs[1]);

      await request(app)
        .post('/webhook')
        .send(faqQuickReply)
        .expect(200);

      expect(facebookIntegration.sendSplitMessages).toHaveBeenCalledTimes(2);
    });

    test('should handle appointment booking flow', async () => {
      const appointmentRequest = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser3.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'I want to book an appointment for tomorrow at 2pm' }
          }]
        }]
      };

      db.saveAppointment = jest.fn().mockResolvedValue();

      await request(app)
        .post('/webhook')
        .send(appointmentRequest)
        .expect(200);

      expect(db.saveAppointment).toHaveBeenCalledWith(
        mockUsers.testUser3.id,
        'Test User',
        expect.any(String), // date
        expect.any(String), // time
        null // phone
      );
      expect(db.logAnalytics).toHaveBeenCalledWith(
        'appointment_booked',
        mockUsers.testUser3.id,
        expect.any(Object)
      );
    });
  });

  describe('Template System Integration', () => {
    test('should load and process templates from database', async () => {
      const templateWithVariables = {
        ...mockPromotionTemplates[1],
        content: 'Hello {{user_name}}! Kitchen renovation is exciting! 🍳',
        variables: JSON.stringify([
          { name: 'user_name', default_value: 'Customer' }
        ])
      };

      db.getActiveTemplates.mockResolvedValue([templateWithVariables]);
      db.getUser.mockResolvedValue({ name: 'John Tan' });

      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'Kitchen renovation deals?' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      // Verify template was processed with user's name
      expect(facebookIntegration.sendSplitMessages).toHaveBeenCalledWith(
        mockUsers.testUser1.id,
        expect.arrayContaining([
          expect.stringContaining('Hello John Tan!')
        ]),
        expect.any(Number)
      );
    });

    test('should handle template with media attachments', async () => {
      const templateWithMedia = {
        ...mockPromotionTemplates[0],
        media_url: 'https://example.com/promotion-image.jpg',
        media_type: 'image'
      };

      db.getActiveTemplates.mockResolvedValue([templateWithMedia]);

      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'Toilet promotion images?' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(facebookIntegration.sendImageMessage).toHaveBeenCalledWith(
        mockUsers.testUser1.id,
        'https://example.com/promotion-image.jpg',
        'Here\'s more information! 📸'
      );
    });

    test('should fallback to static templates when database templates unavailable', async () => {
      db.getActiveTemplates.mockResolvedValue([]);

      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'Sofa promotion available?' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(facebookIntegration.sendSplitMessages).toHaveBeenCalled();
      expect(db.logAnalytics).toHaveBeenCalledWith(
        'promotion_served',
        mockUsers.testUser1.id,
        expect.objectContaining({ category: 'sofas' })
      );
    });
  });

  describe('Human Intervention Integration', () => {
    test('should trigger human intervention for frustrated customers', async () => {
      const frustratedMessage = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'I am very frustrated with your service, this is unacceptable!' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(frustratedMessage)
        .expect(200);

      expect(db.logAnalytics).toHaveBeenCalledWith(
        'human_intervention_requested',
        mockUsers.testUser1.id,
        expect.objectContaining({
          reason: expect.any(String),
          urgency: expect.any(String)
        })
      );
    });

    test('should handle human agent transfer request', async () => {
      const humanRequest = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: '/human' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(humanRequest)
        .expect(200);

      expect(facebookIntegration.passThreadControl).toHaveBeenCalledWith(
        mockUsers.testUser1.id,
        '263902037430900',
        'Customer requested human agent'
      );
    });
  });

  describe('Singapore-specific Conversation Flows', () => {
    test('should handle Singlish conversation flow', async () => {
      const singlishMessages = [
        'Wah uncle, your sofa nice leh!',
        'Got promotion anot?',
        'How much ah?'
      ];

      for (const messageText of singlishMessages) {
        const webhookPayload = {
          object: 'page',
          entry: [{
            messaging: [{
              sender: { id: mockUsers.testUser1.id },
              recipient: { id: 'page_id' },
              timestamp: Date.now(),
              message: { text: messageText }
            }]
          }]
        };

        await request(app)
          .post('/webhook')
          .send(webhookPayload)
          .expect(200);
      }

      expect(generateResponseWithHistory).toHaveBeenCalledTimes(3);
    });

    test('should handle HDB/BTO context in conversations', async () => {
      const housingMessages = [
        'Looking for compact dining table for my BTO',
        'HDB living room quite small, need space-saving sofa',
        'Condo kitchen renovation package got?'
      ];

      for (const messageText of housingMessages) {
        const webhookPayload = {
          object: 'page',
          entry: [{
            messaging: [{
              sender: { id: mockUsers.testUser1.id },
              recipient: { id: 'page_id' },
              timestamp: Date.now(),
              message: { text: messageText }
            }]
          }]
        };

        await request(app)
          .post('/webhook')
          .send(webhookPayload)
          .expect(200);
      }

      expect(generateResponseWithHistory).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling in Conversation Flows', () => {
    test('should handle database errors gracefully', async () => {
      db.saveUser.mockRejectedValue(new Error('Database connection failed'));

      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'Hello' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(facebookIntegration.sendMessageWithTyping).toHaveBeenCalledWith(
        mockUsers.testUser1.id,
        expect.objectContaining({
          message: expect.objectContaining({
            text: expect.stringContaining('error')
          })
        })
      );
    });

    test('should handle Gemini API errors', async () => {
      generateResponseWithHistory.mockRejectedValue(new Error('Gemini API error'));

      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'Tell me about your furniture' }
          }]
        }]
      };

      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(facebookIntegration.sendMessageWithTyping).toHaveBeenCalledWith(
        mockUsers.testUser1.id,
        expect.objectContaining({
          message: expect.objectContaining({
            text: expect.stringContaining('error')
          })
        })
      );
    });

    test('should handle Facebook API errors', async () => {
      facebookIntegration.sendMessageWithTyping.mockRejectedValue(new Error('Facebook API error'));

      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'Hello' }
          }]
        }]
      };

      // Should still return 200 to acknowledge webhook
      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent webhook requests', async () => {
      const concurrentRequests = Array(10).fill().map((_, i) => {
        return request(app)
          .post('/webhook')
          .send({
            object: 'page',
            entry: [{
              messaging: [{
                sender: { id: `user_${i}` },
                recipient: { id: 'page_id' },
                timestamp: Date.now(),
                message: { text: `Message ${i}` }
              }]
            }]
          });
      });

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      expect(db.saveUser).toHaveBeenCalledTimes(10);
      expect(generateResponseWithHistory).toHaveBeenCalledTimes(10);
    });

    test('should handle large conversation history efficiently', async () => {
      // Mock large conversation history
      const largeHistory = Array(50).fill().map((_, i) => ({
        user_message: `Message ${i}`,
        bot_response: `Response ${i}`,
        timestamp: new Date(Date.now() - (i * 60000))
      }));

      db.getConversationHistory.mockResolvedValue(largeHistory);

      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: mockUsers.testUser1.id },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: { text: 'What was our previous conversation about?' }
          }]
        }]
      };

      const startTime = Date.now();
      await request(app)
        .post('/webhook')
        .send(webhookPayload)
        .expect(200);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});