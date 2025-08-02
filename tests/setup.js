/**
 * Jest setup file for ESSEN Facebook Messenger Bot tests
 * Configures global test environment and mocks
 */

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PAGE_ACCESS_TOKEN = 'test_token_12345';
process.env.VERIFY_TOKEN = 'test_verify_token';
process.env.APP_SECRET = 'test_app_secret';
process.env.GEMINI_API_KEY = 'test_gemini_key';
process.env.DB_PATH = ':memory:'; // Use in-memory database for tests
process.env.PORT = '3001'; // Use different port for tests

// Mock console.log to reduce noise in test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Only show errors in test mode, suppress regular logs
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test helpers
global.testHelpers = {
  /**
   * Create a mock Facebook webhook payload
   */
  createWebhookPayload: (senderId, messageText, messageType = 'text') => {
    const basePayload = {
      object: 'page',
      entry: [{
        messaging: [{
          sender: { id: senderId },
          recipient: { id: 'test_page_id' },
          timestamp: Date.now()
        }]
      }]
    };

    if (messageType === 'text') {
      basePayload.entry[0].messaging[0].message = { text: messageText };
    } else if (messageType === 'quick_reply') {
      basePayload.entry[0].messaging[0].message = {
        text: messageText,
        quick_reply: { payload: messageText }
      };
    } else if (messageType === 'postback') {
      basePayload.entry[0].messaging[0].postback = { payload: messageText };
    }

    return basePayload;
  },

  /**
   * Mock Facebook API response
   */
  mockFacebookResponse: (messageId = 'test_message_id') => ({
    data: { message_id: messageId }
  }),

  /**
   * Wait for async operations to complete
   */
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Create mock database methods
   */
  createMockDatabase: () => ({
    saveUser: jest.fn().mockResolvedValue(),
    saveConversation: jest.fn().mockResolvedValue(),
    getConversationHistory: jest.fn().mockResolvedValue([]),
    getUser: jest.fn().mockResolvedValue({ name: 'Test User' }),
    getUserPreferences: jest.fn().mockResolvedValue({}),
    logAnalytics: jest.fn().mockResolvedValue(),
    getBotConfig: jest.fn().mockResolvedValue({ value: '1' }),
    
    // FAQ methods
    searchFAQs: jest.fn().mockResolvedValue([]),
    getActiveFAQs: jest.fn().mockResolvedValue([]),
    getFAQById: jest.fn().mockResolvedValue(null),
    logFAQUsage: jest.fn().mockResolvedValue(),
    
    // Template methods
    getActiveTemplates: jest.fn().mockResolvedValue([]),
    getTemplatesByKeywords: jest.fn().mockResolvedValue([]),
    getTemplateById: jest.fn().mockResolvedValue(null),
    logTemplateUsage: jest.fn().mockResolvedValue(),
    
    // Appointment methods
    saveAppointment: jest.fn().mockResolvedValue(),
    
    // General query method
    query: jest.fn().mockResolvedValue({ rows: [] })
  })
};

// Mock axios globally for Facebook API calls
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: { message_id: 'test_id' } }),
  get: jest.fn().mockResolvedValue({ data: { first_name: 'Test', last_name: 'User' } }),
  create: jest.fn(() => ({
    post: jest.fn().mockResolvedValue({ data: { message_id: 'test_id' } }),
    get: jest.fn().mockResolvedValue({ data: { first_name: 'Test', last_name: 'User' } })
  }))
}));

// Global timeout for all tests
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Unhandled promise rejection handler for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Global error boundary for tests
global.console = {
  ...console,
  // Suppress expected error logs in tests
  error: (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Expected error for testing')) {
      return;
    }
    originalConsoleError(...args);
  }
};