/**
 * Unit tests for human-like conversation features
 * Tests split messages, typing delays, and natural conversation flow
 */

const { 
  sendSplitMessages,
  sendMessageWithTyping,
  calculateTypingDelay,
  delay
} = require('../../src/facebook-integration');

const { mockUsers, mockMessages } = require('../fixtures/testData');

// Mock axios for Facebook API calls
jest.mock('axios');
const axios = require('axios');

// Mock environment variables
process.env.PAGE_ACCESS_TOKEN = 'test_token_12345';

describe('Human-like Conversation Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful Facebook API responses
    axios.post.mockResolvedValue({
      data: { message_id: 'test_message_id' }
    });
  });

  describe('calculateTypingDelay', () => {
    test('should calculate appropriate delay for short messages', () => {
      const shortMessage = 'Hello';
      const delay = calculateTypingDelay(shortMessage);
      
      expect(delay).toBeGreaterThanOrEqual(1000); // Minimum 1 second
      expect(delay).toBeLessThanOrEqual(5000); // Maximum 5 seconds
    });

    test('should calculate longer delay for longer messages', () => {
      const longMessage = 'This is a much longer message that should take more time to type because it has many more words and characters';
      const shortMessage = 'Hi';
      
      const longDelay = calculateTypingDelay(longMessage);
      const shortDelay = calculateTypingDelay(shortMessage);
      
      expect(longDelay).toBeGreaterThan(shortDelay);
    });

    test('should respect minimum and maximum delay bounds', () => {
      const veryShortMessage = 'Hi';
      const veryLongMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';
      
      const shortDelay = calculateTypingDelay(veryShortMessage);
      const longDelay = calculateTypingDelay(veryLongMessage);
      
      expect(shortDelay).toBeGreaterThanOrEqual(1000);
      expect(shortDelay).toBeLessThanOrEqual(5000);
      expect(longDelay).toBeGreaterThanOrEqual(1000);
      expect(longDelay).toBeLessThanOrEqual(5000);
    });

    test('should handle empty messages gracefully', () => {
      const delay = calculateTypingDelay('');
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('sendMessageWithTyping', () => {
    test('should send typing indicator before message', async () => {
      const recipientId = mockUsers.testUser1.id;
      const messageData = {
        recipient: { id: recipientId },
        message: { text: 'Hello there!' }
      };

      await sendMessageWithTyping(recipientId, messageData);

      // Verify typing indicator was sent (typing_on)
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/me/messages'),
        expect.objectContaining({
          recipient: { id: recipientId },
          sender_action: 'typing_on'
        }),
        expect.any(Object)
      );

      // Verify actual message was sent
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/me/messages'),
        messageData,
        expect.any(Object)
      );

      // Verify typing indicator was turned off
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/me/messages'),
        expect.objectContaining({
          recipient: { id: recipientId },
          sender_action: 'typing_off'
        }),
        expect.any(Object)
      );
    });

    test('should handle API errors gracefully', async () => {
      const recipientId = mockUsers.testUser1.id;
      const messageData = {
        recipient: { id: recipientId },
        message: { text: 'Test message' }
      };

      // Mock API error
      axios.post
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ data: { message_id: 'test' } })
        .mockResolvedValueOnce({ data: { message_id: 'test' } });

      await expect(sendMessageWithTyping(recipientId, messageData))
        .rejects.toThrow('API Error');
    });

    test('should include access token in API calls', async () => {
      const recipientId = mockUsers.testUser1.id;
      const messageData = {
        recipient: { id: recipientId },
        message: { text: 'Test' }
      };

      await sendMessageWithTyping(recipientId, messageData);

      // Check that all calls include the access token
      const calls = axios.post.mock.calls;
      calls.forEach(call => {
        expect(call[2].params.access_token).toBe('test_token_12345');
      });
    });
  });

  describe('sendSplitMessages', () => {
    test('should send multiple messages with intervals', async () => {
      const recipientId = mockUsers.testUser1.id;
      const messages = [
        'First message',
        'Second message',
        'Third message'
      ];
      const intervalMs = 1000;

      // Mock delay function to track timing
      const delayMock = jest.fn().mockResolvedValue();
      jest.mock('../../src/facebook-integration', () => ({
        ...jest.requireActual('../../src/facebook-integration'),
        delay: delayMock
      }));

      await sendSplitMessages(recipientId, messages, intervalMs);

      // Verify all messages were sent
      expect(axios.post).toHaveBeenCalledTimes(messages.length * 3); // Each message = typing on + message + typing off

      // Verify message content
      const messageCalls = axios.post.mock.calls.filter(call => 
        call[1].message && call[1].message.text
      );
      
      expect(messageCalls).toHaveLength(3);
      expect(messageCalls[0][1].message.text).toBe('First message');
      expect(messageCalls[1][1].message.text).toBe('Second message');
      expect(messageCalls[2][1].message.text).toBe('Third message');
    });

    test('should handle complex message objects', async () => {
      const recipientId = mockUsers.testUser1.id;
      const messages = [
        'Simple text',
        {
          text: 'Message with quick replies',
          quick_replies: [
            { title: 'Option 1', payload: 'OPT1' },
            { title: 'Option 2', payload: 'OPT2' }
          ]
        }
      ];

      await sendSplitMessages(recipientId, messages, 500);

      // Verify complex message structure was preserved
      const messageCalls = axios.post.mock.calls.filter(call => 
        call[1].message && (call[1].message.text || call[1].message.quick_replies)
      );

      expect(messageCalls[1][1].message.quick_replies).toHaveLength(2);
      expect(messageCalls[1][1].message.quick_replies[0].title).toBe('Option 1');
    });

    test('should handle empty message arrays', async () => {
      const recipientId = mockUsers.testUser1.id;
      const messages = [];

      const result = await sendSplitMessages(recipientId, messages, 1000);

      expect(result).toEqual([]);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should handle single message without intervals', async () => {
      const recipientId = mockUsers.testUser1.id;
      const messages = ['Single message'];

      await sendSplitMessages(recipientId, messages, 1000);

      // Should send message without delay
      expect(axios.post).toHaveBeenCalledTimes(3); // typing on + message + typing off
    });
  });

  describe('delay function', () => {
    test('should delay execution for specified time', async () => {
      const startTime = Date.now();
      const delayTime = 100;

      await delay(delayTime);

      const endTime = Date.now();
      const actualDelay = endTime - startTime;

      // Allow for some timing variance (±10ms)
      expect(actualDelay).toBeGreaterThanOrEqual(delayTime - 10);
      expect(actualDelay).toBeLessThanOrEqual(delayTime + 50);
    });

    test('should handle zero delay', async () => {
      const startTime = Date.now();

      await delay(0);

      const endTime = Date.now();
      const actualDelay = endTime - startTime;

      expect(actualDelay).toBeLessThan(10);
    });
  });

  describe('Human-like conversation timing', () => {
    test('should simulate realistic conversation pace', async () => {
      const recipientId = mockUsers.testUser1.id;
      const conversation = [
        'Hello! Welcome to ESSEN Furniture!',
        'We have amazing deals on sofas today.',
        'Would you like to see our collection?'
      ];

      const startTime = Date.now();
      await sendSplitMessages(recipientId, conversation, 2000);
      const endTime = Date.now();

      // Should take at least some time due to typing simulation
      const totalTime = endTime - startTime;
      expect(totalTime).toBeGreaterThan(100); // At least some delay
    });

    test('should vary typing speed based on message length', async () => {
      const shortMessage = 'Hi';
      const longMessage = 'This is a much longer message that should take significantly more time to type because it contains many more words and characters than the short message';

      const shortDelay = calculateTypingDelay(shortMessage);
      const longDelay = calculateTypingDelay(longMessage);

      expect(longDelay).toBeGreaterThan(shortDelay);
    });
  });

  describe('Error handling in human-like features', () => {
    test('should handle network errors during typing simulation', async () => {
      const recipientId = mockUsers.testUser1.id;
      const messageData = {
        recipient: { id: recipientId },
        message: { text: 'Test message' }
      };

      // Mock network error on typing indicator
      axios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { message_id: 'test' } })
        .mockResolvedValueOnce({ data: { message_id: 'test' } });

      await expect(sendMessageWithTyping(recipientId, messageData))
        .rejects.toThrow('Network error');
    });

    test('should handle partial failures in split messages', async () => {
      const recipientId = mockUsers.testUser1.id;
      const messages = ['Message 1', 'Message 2', 'Message 3'];

      // Mock failure on second message
      axios.post
        .mockResolvedValueOnce({ data: { message_id: 'msg1_typing_on' } })
        .mockResolvedValueOnce({ data: { message_id: 'msg1' } })
        .mockResolvedValueOnce({ data: { message_id: 'msg1_typing_off' } })
        .mockResolvedValueOnce({ data: { message_id: 'msg2_typing_on' } })
        .mockRejectedValueOnce(new Error('Failed to send message 2'))
        .mockResolvedValueOnce({ data: { message_id: 'msg2_typing_off' } });

      await expect(sendSplitMessages(recipientId, messages, 100))
        .rejects.toThrow('Failed to send message 2');
    });
  });

  describe('Singapore context in human-like responses', () => {
    test('should handle Singlish expressions naturally', async () => {
      const recipientId = mockUsers.testUser1.id;
      const singlishMessages = [
        'Wah, very nice sofa leh!',
        'Can help you find perfect one for your home.',
        'Come showroom see see, sure got something you like!'
      ];

      await sendSplitMessages(recipientId, singlishMessages, 3000);

      // Verify all messages were sent correctly
      const messageCalls = axios.post.mock.calls.filter(call => 
        call[1].message && call[1].message.text
      );

      expect(messageCalls).toHaveLength(3);
      expect(messageCalls[0][1].message.text).toContain('Wah');
      expect(messageCalls[2][1].message.text).toContain('see see');
    });

    test('should handle HDB/BTO context in responses', async () => {
      const recipientId = mockUsers.testUser1.id;
      const housingMessages = [
        'Perfect for HDB flat!',
        'Our compact designs work great for BTO.',
        'Many customers very happy with their condo setup!'
      ];

      await sendSplitMessages(recipientId, housingMessages, 2500);

      const messageCalls = axios.post.mock.calls.filter(call => 
        call[1].message && call[1].message.text
      );

      expect(messageCalls[0][1].message.text).toContain('HDB');
      expect(messageCalls[1][1].message.text).toContain('BTO');
      expect(messageCalls[2][1].message.text).toContain('condo');
    });
  });
});