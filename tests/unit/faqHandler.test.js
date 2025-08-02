/**
 * Unit tests for FAQ handler functionality
 * Tests FAQ matching algorithm, confidence scoring, and response generation
 */

const {
  handleFAQInquiry,
  handleFAQQuickReply,
  findMatchingFAQs,
  isFAQInquiry,
  calculateSimilarity,
  extractKeywords
} = require('../../src/faqHandler');

const { 
  mockUsers, 
  mockFAQs,
  singaporeMessages 
} = require('../fixtures/testData');

// Mock database module
jest.mock('../../src/database-pg');
const { db } = require('../../src/database-pg');

// Mock Facebook integration
jest.mock('../../src/facebook-integration');
const {
  sendSplitMessages,
  sendQuickReply,
  delay
} = require('../../src/facebook-integration');

describe('FAQ Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database methods
    db.getBotConfig = jest.fn();
    db.searchFAQs = jest.fn();
    db.getActiveFAQs = jest.fn();
    db.getFAQById = jest.fn();
    db.logFAQUsage = jest.fn();
    db.query = jest.fn();
    
    // Mock Facebook integration methods
    sendSplitMessages.mockResolvedValue([{ message_id: 'test_id' }]);
    sendQuickReply.mockResolvedValue({ message_id: 'test_id' });
    delay.mockResolvedValue();
  });

  describe('isFAQInquiry', () => {
    test('should identify question words as FAQ indicators', () => {
      const faqMessages = [
        'What are your opening hours?',
        'How much does delivery cost?',
        'When can I visit the showroom?',
        'Where is your location?',
        'Why should I choose ESSEN?',
        'Who can I contact for support?',
        'Which products do you recommend?'
      ];

      faqMessages.forEach(message => {
        expect(isFAQInquiry(message)).toBe(true);
      });
    });

    test('should identify questions with question marks', () => {
      const questionMessages = [
        'Do you provide warranty?',
        'Can you help with installation?',
        'Is delivery free?',
        'Are you open on weekends?'
      ];

      questionMessages.forEach(message => {
        expect(isFAQInquiry(message)).toBe(true);
      });
    });

    test('should identify help-seeking phrases', () => {
      const helpMessages = [
        'Can you tell me about your services?',
        'Help me understand your warranty policy',
        'I need information about delivery',
        'Please explain your return policy'
      ];

      helpMessages.forEach(message => {
        expect(isFAQInquiry(message)).toBe(true);
      });
    });

    test('should not identify statements as FAQ inquiries', () => {
      const statementMessages = [
        'I want to buy a sofa',
        'Looking for kitchen renovation',
        'Book appointment for tomorrow',
        'Thank you for your help'
      ];

      statementMessages.forEach(message => {
        expect(isFAQInquiry(message)).toBe(false);
      });
    });

    test('should handle Singlish FAQ inquiries', () => {
      const singlishFAQs = [
        'What time you open ah?',
        'How much delivery cost leh?',
        'Can deliver to my place anot?',
        'Your warranty cover what only?'
      ];

      singlishFAQs.forEach(message => {
        expect(isFAQInquiry(message)).toBe(true);
      });
    });

    test('should handle empty or very short messages', () => {
      expect(isFAQInquiry('')).toBe(false);
      expect(isFAQInquiry('Hi')).toBe(false);
      expect(isFAQInquiry('?')).toBe(true); // Just question mark
    });
  });

  describe('calculateSimilarity', () => {
    test('should calculate high similarity for identical strings', () => {
      const str1 = 'What are your opening hours?';
      const str2 = 'What are your opening hours?';
      
      const similarity = calculateSimilarity(str1, str2);
      expect(similarity).toBe(1.0);
    });

    test('should calculate similarity for similar strings', () => {
      const str1 = 'What are your opening hours?';
      const str2 = 'What are your showroom hours?';
      
      const similarity = calculateSimilarity(str1, str2);
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1.0);
    });

    test('should calculate low similarity for different strings', () => {
      const str1 = 'What are your opening hours?';
      const str2 = 'Do you sell kitchen appliances?';
      
      const similarity = calculateSimilarity(str1, str2);
      expect(similarity).toBeLessThan(0.3);
    });

    test('should handle case insensitive comparison', () => {
      const str1 = 'WHAT ARE YOUR HOURS?';
      const str2 = 'what are your hours?';
      
      const similarity = calculateSimilarity(str1, str2);
      expect(similarity).toBe(1.0);
    });

    test('should handle empty strings', () => {
      const similarity1 = calculateSimilarity('', '');
      const similarity2 = calculateSimilarity('hello', '');
      
      expect(similarity1).toBe(1.0); // Empty sets have similarity 1
      expect(similarity2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('extractKeywords', () => {
    test('should extract meaningful keywords', () => {
      const message = 'What are your showroom opening hours today?';
      const keywords = extractKeywords(message);
      
      expect(keywords).toContain('showroom');
      expect(keywords).toContain('opening');
      expect(keywords).toContain('hours');
      expect(keywords).toContain('today');
      
      // Should not contain stop words
      expect(keywords).not.toContain('what');
      expect(keywords).not.toContain('are');
      expect(keywords).not.toContain('your');
    });

    test('should filter out short words and stop words', () => {
      const message = 'Can you tell me the delivery cost for my order?';
      const keywords = extractKeywords(message);
      
      expect(keywords).toContain('delivery');
      expect(keywords).toContain('cost');
      expect(keywords).toContain('order');
      
      // Should not contain stop words or short words
      expect(keywords).not.toContain('can');
      expect(keywords).not.toContain('you');
      expect(keywords).not.toContain('me');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('my');
    });

    test('should handle punctuation and special characters', () => {
      const message = 'What\'s your warranty policy? How long does it last?';
      const keywords = extractKeywords(message);
      
      expect(keywords).toContain('warranty');
      expect(keywords).toContain('policy');
      expect(keywords).toContain('long');
      expect(keywords).toContain('last');
    });

    test('should handle Singlish keywords', () => {
      const message = 'Showroom where ah? Can go there anot?';
      const keywords = extractKeywords(message);
      
      expect(keywords).toContain('showroom');
      expect(keywords).toContain('where');
      expect(keywords).toContain('there');
      expect(keywords).toContain('anot');
    });
  });

  describe('findMatchingFAQs', () => {
    test('should find matching FAQs using database search', async () => {
      const message = 'What are your opening hours?';
      const expectedResults = [
        { ...mockFAQs[0], relevance_score: 95 }
      ];
      
      db.searchFAQs.mockResolvedValue(expectedResults);
      
      const results = await findMatchingFAQs(message, 5);
      
      expect(db.searchFAQs).toHaveBeenCalledWith(message, 5);
      expect(results).toEqual(expectedResults);
    });

    test('should fallback to similarity calculation when no database results', async () => {
      const message = 'Showroom operating times?';
      
      db.searchFAQs.mockResolvedValue([]);
      db.getActiveFAQs.mockResolvedValue(mockFAQs);
      
      const results = await findMatchingFAQs(message, 3);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('similarity_score');
      expect(results[0]).toHaveProperty('relevance_score');
    });

    test('should filter results by confidence threshold', async () => {
      const message = 'Random unrelated question about space aliens';
      
      db.searchFAQs.mockResolvedValue([]);
      db.getActiveFAQs.mockResolvedValue(mockFAQs);
      
      const results = await findMatchingFAQs(message, 5);
      
      // Should return no results for very low similarity
      expect(results.length).toBe(0);
    });

    test('should sort results by similarity score', async () => {
      const message = 'delivery information';
      
      db.searchFAQs.mockResolvedValue([]);
      db.getActiveFAQs.mockResolvedValue(mockFAQs);
      
      const results = await findMatchingFAQs(message, 5);
      
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i-1].similarity_score).toBeGreaterThanOrEqual(results[i].similarity_score);
        }
      }
    });

    test('should handle database errors gracefully', async () => {
      const message = 'What are your hours?';
      
      db.searchFAQs.mockRejectedValue(new Error('Database error'));
      db.getActiveFAQs.mockRejectedValue(new Error('Database error'));
      
      const results = await findMatchingFAQs(message, 5);
      
      expect(results).toEqual([]);
    });
  });

  describe('handleFAQInquiry', () => {
    test('should return null when FAQ matching is disabled', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'What are your hours?';
      
      db.getBotConfig.mockResolvedValue({ value: '0' });
      
      const result = await handleFAQInquiry(senderId, message);
      
      expect(result).toBeNull();
    });

    test('should return null for non-FAQ messages', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'I want to buy a sofa';
      
      db.getBotConfig.mockResolvedValue({ value: '1' });
      
      const result = await handleFAQInquiry(senderId, message);
      
      expect(result).toBeNull();
    });

    test('should handle high confidence FAQ matches directly', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'What are your opening hours?';
      
      db.getBotConfig.mockResolvedValue({ value: '1' });
      db.searchFAQs.mockResolvedValue([
        { ...mockFAQs[0], relevance_score: 95 }
      ]);
      
      const result = await handleFAQInquiry(senderId, message);
      
      expect(result.handled).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.response_type).toBe('direct');
      expect(sendSplitMessages).toHaveBeenCalledWith(senderId, [mockFAQs[0].answer], 3000);
      expect(db.logFAQUsage).toHaveBeenCalled();
    });

    test('should ask for confirmation on medium confidence matches', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'Opening times?';
      
      db.getBotConfig.mockResolvedValue({ value: '1' });
      db.searchFAQs.mockResolvedValue([
        { ...mockFAQs[0], relevance_score: 70 }
      ]);
      
      const result = await handleFAQInquiry(senderId, message);
      
      expect(result.handled).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.response_type).toBe('confirmation');
      expect(sendQuickReply).toHaveBeenCalled();
    });

    test('should provide multiple options for low confidence matches', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'Help with something';
      
      db.getBotConfig.mockResolvedValue({ value: '1' });
      db.searchFAQs.mockResolvedValue([]);
      db.getActiveFAQs.mockResolvedValue(mockFAQs);
      
      // Mock low similarity scores
      jest.spyOn(require('../../src/faqHandler'), 'calculateSimilarity')
        .mockReturnValue(0.5); // Medium-low similarity
      
      const result = await handleFAQInquiry(senderId, message);
      
      if (result) {
        expect(result.handled).toBe(true);
        expect(result.response_type).toBe('options');
        expect(sendQuickReply).toHaveBeenCalled();
      }
    });

    test('should return null when no matching FAQs found', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'What is the meaning of life?';
      
      db.getBotConfig.mockResolvedValue({ value: '1' });
      db.searchFAQs.mockResolvedValue([]);
      db.getActiveFAQs.mockResolvedValue(mockFAQs);
      
      const result = await handleFAQInquiry(senderId, message);
      
      expect(result).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'What are your hours?';
      
      db.getBotConfig.mockResolvedValue({ value: '1' });
      db.searchFAQs.mockRejectedValue(new Error('Database error'));
      
      const result = await handleFAQInquiry(senderId, message);
      
      expect(result).toBeNull();
    });
  });

  describe('handleFAQQuickReply', () => {
    test('should handle FAQ confirmation', async () => {
      const senderId = mockUsers.testUser1.id;
      const payload = 'FAQ_CONFIRM_1';
      
      db.getFAQById.mockResolvedValue(mockFAQs[0]);
      
      const result = await handleFAQQuickReply(senderId, payload);
      
      expect(result).toBe(true);
      expect(sendSplitMessages).toHaveBeenCalledWith(senderId, [mockFAQs[0].answer], 3000);
      expect(sendQuickReply).toHaveBeenCalledWith(
        senderId,
        'Hope that helps! Anything else I can assist with?',
        ['Visit showroom', 'View products', 'Book consultation']
      );
    });

    test('should handle FAQ selection', async () => {
      const senderId = mockUsers.testUser1.id;
      const payload = 'FAQ_SELECT_2';
      
      db.getFAQById.mockResolvedValue(mockFAQs[1]);
      
      const result = await handleFAQQuickReply(senderId, payload);
      
      expect(result).toBe(true);
      expect(sendSplitMessages).toHaveBeenCalledWith(senderId, [mockFAQs[1].answer], 3000);
    });

    test('should handle "other options" request', async () => {
      const senderId = mockUsers.testUser1.id;
      const payload = 'FAQ_OTHER_OPTIONS';
      
      const result = await handleFAQQuickReply(senderId, payload);
      
      expect(result).toBe(true);
      expect(sendSplitMessages).toHaveBeenCalledWith(
        senderId,
        expect.arrayContaining([
          expect.stringContaining('No problem'),
          expect.stringContaining('help you find')
        ]),
        3000
      );
    });

    test('should handle "show more" request', async () => {
      const senderId = mockUsers.testUser1.id;
      const payload = 'FAQ_SHOW_MORE';
      
      const result = await handleFAQQuickReply(senderId, payload);
      
      expect(result).toBe(true);
      expect(sendSplitMessages).toHaveBeenCalledWith(
        senderId,
        expect.arrayContaining([
          expect.stringContaining('connect you'),
          expect.stringContaining('showroom')
        ]),
        3000
      );
    });

    test('should handle "none match" response', async () => {
      const senderId = mockUsers.testUser1.id;
      const payload = 'FAQ_NONE_MATCH';
      
      const result = await handleFAQQuickReply(senderId, payload);
      
      expect(result).toBe(true);
      expect(sendSplitMessages).toHaveBeenCalledWith(
        senderId,
        expect.arrayContaining([
          expect.stringContaining('understand'),
          expect.stringContaining('different way')
        ]),
        3000
      );
    });

    test('should handle "need more help" request', async () => {
      const senderId = mockUsers.testUser1.id;
      const payload = 'NEED_MORE_HELP';
      
      const result = await handleFAQQuickReply(senderId, payload);
      
      expect(result).toBe(true);
      expect(sendQuickReply).toHaveBeenCalledWith(
        senderId,
        'How else can I help you today?',
        ['Visit showroom', 'View products', 'Book consultation', 'Speak to human']
      );
    });

    test('should return false for unrecognized payloads', async () => {
      const senderId = mockUsers.testUser1.id;
      const payload = 'UNKNOWN_PAYLOAD';
      
      const result = await handleFAQQuickReply(senderId, payload);
      
      expect(result).toBe(false);
    });

    test('should handle missing FAQ gracefully', async () => {
      const senderId = mockUsers.testUser1.id;
      const payload = 'FAQ_CONFIRM_999';
      
      db.getFAQById.mockResolvedValue(null);
      
      const result = await handleFAQQuickReply(senderId, payload);
      
      expect(result).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      const senderId = mockUsers.testUser1.id;
      const payload = 'FAQ_CONFIRM_1';
      
      db.getFAQById.mockRejectedValue(new Error('Database error'));
      
      const result = await handleFAQQuickReply(senderId, payload);
      
      expect(result).toBe(false);
    });
  });

  describe('Singapore-specific FAQ handling', () => {
    test('should handle Singlish FAQ inquiries', async () => {
      const testCases = [
        'What time you open ah?',
        'Delivery how much leh?',
        'Can deliver to my place anot?',
        'Warranty cover what only?'
      ];

      db.getBotConfig.mockResolvedValue({ value: '1' });
      
      for (const message of testCases) {
        // Should recognize as FAQ inquiry
        expect(isFAQInquiry(message)).toBe(true);
        
        // Should extract relevant keywords
        const keywords = extractKeywords(message);
        expect(keywords.length).toBeGreaterThan(0);
      }
    });

    test('should match HDB/BTO related FAQs', async () => {
      const housingFAQs = [
        'Do you deliver to HDB flats?',
        'Installation service for BTO?',
        'Furniture suitable for condo?',
        'Executive flat renovation packages?'
      ];

      db.getBotConfig.mockResolvedValue({ value: '1' });
      db.searchFAQs.mockResolvedValue([]);
      db.getActiveFAQs.mockResolvedValue(mockFAQs);

      for (const message of housingFAQs) {
        const result = await handleFAQInquiry(mockUsers.testUser1.id, message);
        // Should at least attempt to find matches
        expect(db.searchFAQs).toHaveBeenCalled();
      }
    });

    test('should understand local context in FAQ matching', () => {
      const localQuestions = [
        'Showroom near MRT?',
        'Can take bus to your place?',
        'Parking available or not?',
        'Weekend also open meh?'
      ];

      localQuestions.forEach(question => {
        const keywords = extractKeywords(question);
        expect(keywords.length).toBeGreaterThan(0);
        
        // Should recognize as FAQ
        expect(isFAQInquiry(question)).toBe(true);
      });
    });
  });

  describe('FAQ Analytics and Performance', () => {
    test('should log FAQ usage for analytics', async () => {
      const senderId = mockUsers.testUser1.id;
      const message = 'What are your hours?';
      
      db.getBotConfig.mockResolvedValue({ value: '1' });
      db.searchFAQs.mockResolvedValue([
        { ...mockFAQs[0], relevance_score: 90 }
      ]);
      
      await handleFAQInquiry(senderId, message);
      
      expect(db.logFAQUsage).toHaveBeenCalledWith(
        mockFAQs[0].id,
        senderId,
        message
      );
    });

    test('should handle multiple concurrent FAQ requests', async () => {
      const requests = Array(5).fill().map((_, i) => ({
        senderId: `user_${i}`,
        message: `FAQ question ${i}`
      }));

      db.getBotConfig.mockResolvedValue({ value: '1' });
      db.searchFAQs.mockResolvedValue([]);
      db.getActiveFAQs.mockResolvedValue(mockFAQs);

      const promises = requests.map(req => 
        handleFAQInquiry(req.senderId, req.message)
      );

      const results = await Promise.all(promises);
      
      // All requests should complete without errors
      expect(results).toHaveLength(5);
    });

    test('should calculate similarity efficiently for large FAQ sets', async () => {
      const largeFAQSet = Array(100).fill().map((_, i) => ({
        ...mockFAQs[0],
        id: i + 1,
        question: `FAQ question number ${i + 1}`,
        answer: `Answer to question ${i + 1}`
      }));

      const message = 'Random question';
      
      db.searchFAQs.mockResolvedValue([]);
      db.getActiveFAQs.mockResolvedValue(largeFAQSet);

      const startTime = Date.now();
      await findMatchingFAQs(message, 10);
      const endTime = Date.now();

      // Should complete within reasonable time (< 1 second for 100 FAQs)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});