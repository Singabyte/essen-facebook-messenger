/**
 * Unit tests for promotion handler functionality
 * Tests promotion detection, template processing, variable substitution, and follow-up logic
 */

const {
  detectPromotionInquiry,
  handlePromotionInquiry,
  sendPromotionWithImage,
  analyzePromotionUrgency,
  getContextualFollowUp,
  processTemplateContent,
  extractUserContext,
  testTemplate,
  PROMOTION_KEYWORDS,
  PROMOTION_TEMPLATES
} = require('../../src/promotionHandler');

const { 
  mockUsers, 
  mockPromotionTemplates, 
  mockBotConfig,
  singaporeMessages 
} = require('../fixtures/testData');

// Mock database module
jest.mock('../../src/database-pg');
const { db } = require('../../src/database-pg');

// Mock Facebook integration
jest.mock('../../src/facebook-integration');
const {
  sendSplitMessages,
  sendImageMessage,
  delay
} = require('../../src/facebook-integration');

describe('Promotion Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database methods
    db.getActiveTemplates = jest.fn();
    db.getTemplatesByKeywords = jest.fn();
    db.getTemplateById = jest.fn();
    db.getUser = jest.fn();
    db.getUserPreferences = jest.fn();
    db.logTemplateUsage = jest.fn();
    db.getBotConfig = jest.fn();
    db.logAnalytics = jest.fn();
    
    // Mock Facebook integration methods
    sendSplitMessages.mockResolvedValue([{ message_id: 'test_id' }]);
    sendImageMessage.mockResolvedValue({ message_id: 'test_id' });
    delay.mockResolvedValue();
  });

  describe('detectPromotionInquiry', () => {
    test('should detect toilet promotion inquiries', async () => {
      const testMessages = [
        'Do you have toilet sets on promotion?',
        'Any toilet bowl deals?',
        'WC promotion got or not?',
        'Bathroom set offer available?'
      ];

      for (const message of testMessages) {
        const category = await detectPromotionInquiry(message);
        expect(category).toBe('toilet_sets');
      }
    });

    test('should detect kitchen promotion inquiries', async () => {
      const testMessages = [
        'Kitchen sink promotion?',
        'Any deals on kitchen appliances?',
        'Kitchen set got discount?',
        'Tap and sink package promotion?'
      ];

      for (const message of testMessages) {
        const category = await detectPromotionInquiry(message);
        expect(category).toBe('kitchen_appliances');
      }
    });

    test('should detect sofa promotion inquiries', async () => {
      const testMessages = [
        'Sofa promotion available?',
        'Leather sofa on sale?',
        'Living room set deals?',
        'Sectional sofa discount?'
      ];

      for (const message of testMessages) {
        const category = await detectPromotionInquiry(message);
        expect(category).toBe('sofas');
      }
    });

    test('should detect general promotion inquiries', async () => {
      const testMessages = [
        'Any promotions available?',
        'Current deals?',
        'What offers do you have?',
        'Any discounts running?'
      ];

      for (const message of testMessages) {
        const category = await detectPromotionInquiry(message);
        expect(category).toBe('general_promo');
      }
    });

    test('should return null for non-promotion messages', async () => {
      const testMessages = [
        'Hello',
        'What are your opening hours?',
        'Where is your showroom?',
        'Thank you'
      ];

      for (const message of testMessages) {
        const category = await detectPromotionInquiry(message);
        expect(category).toBeNull();
      }
    });

    test('should handle Singlish promotion inquiries', async () => {
      const singlishMessages = [
        'Eh bro, sofa got promotion anot?',
        'Uncle, toilet bowl cheap cheap got?',
        'Kitchen renovation package how much ah?',
        'Wah your dining table got discount or not?'
      ];

      // Should detect despite Singlish expressions
      expect(await detectPromotionInquiry(singlishMessages[0])).toBe('sofas');
      expect(await detectPromotionInquiry(singlishMessages[1])).toBe('toilet_sets');
      expect(await detectPromotionInquiry(singlishMessages[2])).toBe('kitchen_appliances');
      expect(await detectPromotionInquiry(singlishMessages[3])).toBe('dining');
    });

    test('should check database templates when static keywords fail', async () => {
      const message = 'Special furniture deals';
      
      db.getTemplatesByKeywords.mockResolvedValue([
        { category: 'custom_promo', id: 1 }
      ]);

      const category = await detectPromotionInquiry(message);
      
      expect(db.getTemplatesByKeywords).toHaveBeenCalled();
      expect(category).toBe('custom_promo');
    });
  });

  describe('processTemplateContent', () => {
    test('should substitute variables correctly', () => {
      const template = {
        content: 'Hello {{user_name}}! Check out our {{category}} promotion at {{timestamp}}.',
        variables: JSON.stringify([
          { name: 'user_name', default_value: 'Customer' },
          { name: 'category', default_value: 'furniture' },
          { name: 'timestamp', default_value: 'now' }
        ]),
        quick_replies: JSON.stringify([
          { title: 'Learn more', payload: 'LEARN_MORE' }
        ])
      };

      const variables = {
        user_name: 'John Tan',
        category: 'sofa',
        timestamp: '2pm today'
      };

      const result = processTemplateContent(template, variables);

      expect(result.content).toBe('Hello John Tan! Check out our sofa promotion at 2pm today.');
      expect(result.quickReplies).toHaveLength(1);
      expect(result.quickReplies[0].title).toBe('Learn more');
    });

    test('should use default values when variables not provided', () => {
      const template = {
        content: 'Welcome {{user_name}}! Our {{product_type}} collection is amazing.',
        variables: JSON.stringify([
          { name: 'user_name', default_value: 'Customer' },
          { name: 'product_type', default_value: 'furniture' }
        ]),
        quick_replies: JSON.stringify([])
      };

      const result = processTemplateContent(template, {});

      expect(result.content).toBe('Welcome Customer! Our furniture collection is amazing.');
    });

    test('should handle templates without variables', () => {
      const template = {
        content: 'Static promotion message without variables.',
        variables: JSON.stringify([]),
        quick_replies: JSON.stringify([
          { title: 'View products', payload: 'VIEW_PRODUCTS' }
        ])
      };

      const result = processTemplateContent(template, {});

      expect(result.content).toBe('Static promotion message without variables.');
      expect(result.quickReplies).toHaveLength(1);
    });

    test('should handle malformed JSON gracefully', () => {
      const template = {
        content: 'Hello {{user_name}}!',
        variables: 'invalid json',
        quick_replies: 'also invalid'
      };

      const result = processTemplateContent(template, { user_name: 'John' });

      // Should fallback to original content
      expect(result.content).toBe('Hello {{user_name}}!');
      expect(result.quickReplies).toEqual([]);
    });

    test('should substitute variables in quick reply titles', () => {
      const template = {
        content: 'Hello {{user_name}}!',
        variables: JSON.stringify([
          { name: 'user_name', default_value: 'Customer' }
        ]),
        quick_replies: JSON.stringify([
          { title: 'Book for {{user_name}}', payload: 'BOOK' }
        ])
      };

      const result = processTemplateContent(template, { user_name: 'Mary' });

      expect(result.quickReplies[0].title).toBe('Book for Mary');
    });
  });

  describe('handlePromotionInquiry', () => {
    test('should handle database template promotion', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'Do you have toilet promotions?';
      const category = 'toilet_sets';

      // Mock database response
      db.getActiveTemplates.mockResolvedValue([mockPromotionTemplates[0]]);
      db.getUser.mockResolvedValue({ name: 'John Tan' });
      db.getUserPreferences.mockResolvedValue({});
      db.getBotConfig.mockResolvedValue({ value: '300000' });

      const result = await handlePromotionInquiry(senderId, message, category);

      expect(result.handled).toBe(true);
      expect(result.source).toBe('database');
      expect(result.template_id).toBe(1);
      expect(db.logTemplateUsage).toHaveBeenCalledWith(1, senderId, message);
      expect(sendSplitMessages).toHaveBeenCalled();
    });

    test('should fallback to static templates', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'Kitchen promotion?';
      const category = 'kitchen_appliances';

      // Mock empty database response
      db.getActiveTemplates.mockResolvedValue([]);

      const result = await handlePromotionInquiry(senderId, message, category);

      expect(result.handled).toBe(true);
      expect(result.source).toBe('static');
      expect(result.quick_replies).toEqual(PROMOTION_TEMPLATES.kitchen_appliances.quick_replies);
    });

    test('should handle unknown promotion categories', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'Unknown category promotion';
      const category = 'unknown_category';

      db.getActiveTemplates.mockResolvedValue([]);

      const result = await handlePromotionInquiry(senderId, message, category);

      expect(result).toBeNull();
    });

    test('should send media if available in template', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'Show me toilet promotions';
      const category = 'toilet_sets';

      const templateWithMedia = {
        ...mockPromotionTemplates[0],
        media_url: 'https://example.com/toilet-promo.jpg'
      };

      db.getActiveTemplates.mockResolvedValue([templateWithMedia]);
      db.getUser.mockResolvedValue({ name: 'John' });
      db.getUserPreferences.mockResolvedValue({});

      await handlePromotionInquiry(senderId, message, category);

      expect(sendImageMessage).toHaveBeenCalledWith(
        senderId,
        'https://example.com/toilet-promo.jpg',
        'Here\'s more information! 📸'
      );
    });

    test('should log analytics for promotion inquiries', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'Sofa deals?';
      const category = 'sofas';

      db.getActiveTemplates.mockResolvedValue([]);

      await handlePromotionInquiry(senderId, message, category);

      expect(db.logAnalytics).toHaveBeenCalledWith(
        'promotion_inquiry',
        senderId,
        { category, original_message: message }
      );
    });
  });

  describe('analyzePromotionUrgency', () => {
    test('should detect urgent keywords', () => {
      const urgentMessages = [
        'Need sofa urgently!',
        'Kitchen renovation ASAP',
        'Immediate delivery required',
        'Need furniture today'
      ];

      urgentMessages.forEach(message => {
        const analysis = analyzePromotionUrgency(message);
        expect(analysis.urgent).toBe(true);
      });
    });

    test('should detect price-focused inquiries', () => {
      const priceMessages = [
        'How much for sofa?',
        'What\'s the cost of kitchen set?',
        'Looking for budget furniture',
        'Cheap dining table available?'
      ];

      priceMessages.forEach(message => {
        const analysis = analyzePromotionUrgency(message);
        expect(analysis.price_focused).toBe(true);
      });
    });

    test('should detect comparison-seeking inquiries', () => {
      const comparisonMessages = [
        'Compare sofa models',
        'Kitchen sink vs bathroom sink',
        'Which is better?',
        'What\'s the difference between sets?'
      ];

      comparisonMessages.forEach(message => {
        const analysis = analyzePromotionUrgency(message);
        expect(analysis.comparison_seeking).toBe(true);
      });
    });

    test('should detect multiple urgency types', () => {
      const message = 'Need to compare prices urgently for kitchen renovation';
      const analysis = analyzePromotionUrgency(message);

      expect(analysis.urgent).toBe(true);
      expect(analysis.price_focused).toBe(true);
      expect(analysis.comparison_seeking).toBe(true);
    });

    test('should handle non-urgent messages', () => {
      const regularMessage = 'Looking at sofa options for my living room';
      const analysis = analyzePromotionUrgency(regularMessage);

      expect(analysis.urgent).toBe(false);
      expect(analysis.price_focused).toBe(false);
      expect(analysis.comparison_seeking).toBe(false);
    });
  });

  describe('getContextualFollowUp', () => {
    test('should provide urgent follow-up for toilet sets', () => {
      const category = 'toilet_sets';
      const urgency = { urgent: true, price_focused: false, comparison_seeking: false };

      const followUp = getContextualFollowUp(category, urgency);

      expect(followUp).toContain('urgent');
      expect(followUp).toContain('ready stock');
    });

    test('should provide price-focused follow-up for kitchen', () => {
      const category = 'kitchen_appliances';
      const urgency = { urgent: false, price_focused: true, comparison_seeking: false };

      const followUp = getContextualFollowUp(category, urgency);

      expect(followUp).toContain('packages');
      expect(followUp).toContain('value');
    });

    test('should provide comparison follow-up', () => {
      const category = 'kitchen_appliances';
      const urgency = { urgent: false, price_focused: false, comparison_seeking: true };

      const followUp = getContextualFollowUp(category, urgency);

      expect(followUp).toContain('consultants');
      expect(followUp).toContain('different');
    });

    test('should return null for unknown categories', () => {
      const category = 'unknown_category';
      const urgency = { urgent: true, price_focused: false, comparison_seeking: false };

      const followUp = getContextualFollowUp(category, urgency);

      expect(followUp).toBeNull();
    });

    test('should return null when no urgency detected', () => {
      const category = 'toilet_sets';
      const urgency = { urgent: false, price_focused: false, comparison_seeking: false };

      const followUp = getContextualFollowUp(category, urgency);

      expect(followUp).toBeNull();
    });
  });

  describe('extractUserContext', () => {
    test('should extract user context successfully', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'Looking for furniture';

      db.getUser.mockResolvedValue({
        id: senderId,
        name: 'John Tan',
        first_interaction: false
      });
      db.getUserPreferences.mockResolvedValue({
        language: 'en',
        preferred_categories: ['sofas', 'dining']
      });

      const context = await extractUserContext(senderId, message);

      expect(context.user_name).toBe('John Tan');
      expect(context.current_message).toBe('Looking for furniture');
      expect(context.user_preferences.language).toBe('en');
      expect(context.timestamp).toBeDefined();
    });

    test('should handle missing user data gracefully', async () => {
      const senderId = 'unknown_user';
      const message = 'Test message';

      db.getUser.mockResolvedValue(null);
      db.getUserPreferences.mockResolvedValue({});

      const context = await extractUserContext(senderId, message);

      expect(context.user_name).toBe('Customer');
      expect(context.current_message).toBe('Test message');
    });

    test('should handle database errors gracefully', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'Test message';

      db.getUser.mockRejectedValue(new Error('Database error'));
      db.getUserPreferences.mockRejectedValue(new Error('Database error'));

      const context = await extractUserContext(senderId, message);

      expect(context.user_name).toBe('Customer');
      expect(context.current_message).toBe('Test message');
    });
  });

  describe('testTemplate', () => {
    test('should test template with sample variables', async () => {
      const templateId = 1;
      const testVariables = {
        user_name: 'Test User',
        category: 'test category'
      };

      db.getTemplateById.mockResolvedValue(mockPromotionTemplates[0]);

      const result = await testTemplate(templateId, testVariables);

      expect(result.template_id).toBe(templateId);
      expect(result.original_content).toBe(mockPromotionTemplates[0].content);
      expect(result.test_variables).toEqual(testVariables);
      expect(result.variables_used).toBeDefined();
    });

    test('should handle non-existent templates', async () => {
      const templateId = 999;

      db.getTemplateById.mockResolvedValue(null);

      const result = await testTemplate(templateId, {});

      expect(result).toBeNull();
    });

    test('should handle database errors in template testing', async () => {
      const templateId = 1;

      db.getTemplateById.mockRejectedValue(new Error('Database error'));

      const result = await testTemplate(templateId, {});

      expect(result).toBeNull();
    });
  });

  describe('sendPromotionWithImage', () => {
    test('should send database template with image', async () => {
      const senderId = mockUsers.testUser1.id;
      const category = 'toilet_sets';

      const templateWithImage = {
        ...mockPromotionTemplates[0],
        media_url: 'https://example.com/promotion.jpg'
      };

      db.getActiveTemplates.mockResolvedValue([templateWithImage]);
      db.getUser.mockResolvedValue({ name: 'John' });
      db.getUserPreferences.mockResolvedValue({});

      const quickReplies = await sendPromotionWithImage(senderId, category);

      expect(sendImageMessage).toHaveBeenCalledWith(
        senderId,
        'https://example.com/promotion.jpg',
        'Here are our current options! 📸'
      );
      expect(sendSplitMessages).toHaveBeenCalled();
      expect(db.logTemplateUsage).toHaveBeenCalled();
      expect(quickReplies).toBeDefined();
    });

    test('should fallback to static promotion images', async () => {
      const senderId = mockUsers.testUser1.id;
      const category = 'sofas';

      db.getActiveTemplates.mockResolvedValue([]);

      const quickReplies = await sendPromotionWithImage(senderId, category);

      expect(sendImageMessage).toHaveBeenCalled();
      expect(sendSplitMessages).toHaveBeenCalled();
      expect(quickReplies).toEqual(PROMOTION_TEMPLATES.sofas.quick_replies);
    });

    test('should handle errors gracefully', async () => {
      const senderId = mockUsers.testUser1.id;
      const category = 'toilet_sets';

      db.getActiveTemplates.mockRejectedValue(new Error('Database error'));

      const quickReplies = await sendPromotionWithImage(senderId, category);

      expect(quickReplies).toEqual([]);
    });
  });

  describe('Singapore-specific promotion handling', () => {
    test('should handle Singlish promotion inquiries correctly', async () => {
      const testCases = [
        { message: 'Wah uncle, toilet bowl got promotion anot?', expectedCategory: 'toilet_sets' },
        { message: 'Eh bro, kitchen sink cheap cheap got?', expectedCategory: 'kitchen_appliances' },
        { message: 'Aiyo need sofa for BTO leh', expectedCategory: 'sofas' },
        { message: 'Dining table for HDB flat got discount?', expectedCategory: 'dining' }
      ];

      for (const testCase of testCases) {
        const category = await detectPromotionInquiry(testCase.message);
        expect(category).toBe(testCase.expectedCategory);
      }
    });

    test('should handle housing context in promotions', async () => {
      const messages = [
        'BTO kitchen package promotion?',
        'HDB renovation deals?',
        'Condo furniture promotion?',
        'Executive flat dining set offer?'
      ];

      for (const message of messages) {
        const category = await detectPromotionInquiry(message);
        expect(category).not.toBeNull(); // Should detect some category
      }
    });
  });
});