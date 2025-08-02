# ESSEN Facebook Messenger Bot - Testing Suite

This directory contains comprehensive tests for the ESSEN Facebook Messenger Bot, covering unit tests, integration tests, and end-to-end tests.

## Test Structure

```
tests/
├── unit/                           # Unit tests for individual components
│   ├── humanLikeConversation.test.js    # Human-like messaging features
│   ├── promotionHandler.test.js         # Promotion detection and handling
│   └── faqHandler.test.js               # FAQ matching and responses
├── integration/                    # Integration tests for complete flows
│   └── conversationFlow.test.js         # End-to-end conversation testing
├── e2e/                           # End-to-end user journey tests
│   └── promotionJourney.test.js         # Complete promotion user journeys
├── fixtures/                      # Test data and mocks
│   └── testData.js                      # Mock users, messages, templates
├── setup.js                      # Jest configuration and global mocks
└── README.md                     # This file
```

## Test Categories

### Unit Tests (`npm run test:unit`)

Tests individual functions and components in isolation:

- **Human-like Conversation Features**
  - Split message functionality
  - Typing delay calculations
  - Message timing simulation
  - Natural conversation flow

- **Promotion Handler**
  - Promotion detection algorithms
  - Template variable substitution
  - Urgency analysis
  - Follow-up message scheduling

- **FAQ Handler**
  - FAQ matching algorithms
  - Confidence scoring
  - Similarity calculations
  - Quick reply handling

### Integration Tests (`npm run test:integration`)

Tests complete conversation flows and system integration:

- **Conversation Flow Integration**
  - Multi-turn conversations
  - Template loading and processing
  - Database interactions
  - Facebook API integration
  - Error handling and recovery

### End-to-End Tests (`npm run test:e2e`)

Tests complete user journeys from start to finish:

- **Promotion Journey Testing**
  - Complete promotion inquiry flows
  - Multi-channel handoffs
  - Singapore-specific scenarios
  - Performance benchmarks
  - Conversion tracking

## Singapore-Specific Testing

Our tests include comprehensive coverage for Singapore context:

- **Singlish Language Support**
  - "lah", "leh", "anot" expressions
  - Local colloquialisms
  - Mixed English-Singlish conversations

- **Housing Context**
  - HDB flat references
  - BTO (Build-To-Order) scenarios
  - Condo and executive flat mentions
  - Space constraints and solutions

- **Local Business Context**
  - Operating hours (11am-7pm)
  - Singapore address format
  - Local delivery expectations
  - WhatsApp communication preferences

## Running Tests

### Prerequisites

```bash
npm install
```

### Run All Tests

```bash
npm run test:all
```

### Run Specific Test Types

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# End-to-end tests only
npm run test:e2e

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Individual Test Files

```bash
# Test specific components
npx jest tests/unit/promotionHandler.test.js
npx jest tests/unit/faqHandler.test.js
npx jest tests/unit/humanLikeConversation.test.js

# Test specific flows
npx jest tests/integration/conversationFlow.test.js

# Test specific journeys
npx playwright test tests/e2e/promotionJourney.test.js
```

## Test Data and Fixtures

### Mock Users
- `testUser1`: John Tan (general furniture inquiries)
- `testUser2`: Mary Lim (kitchen/bathroom focus)
- `testUser3`: Ahmad Rahman (urgent requests)

### Mock Promotion Templates
- Toilet sets promotion with variables
- Kitchen solutions with media
- Sofa collections with quick replies

### Mock FAQs
- Operating hours
- Delivery information
- Warranty policies

### Singapore Context Data
- Singlish expressions and responses
- Housing type references (HDB, BTO, condo)
- Local urgency indicators

## Performance Benchmarks

Our tests include performance benchmarks to ensure:

- **Response Time**: < 2 seconds average
- **Concurrent Users**: Handle 50+ simultaneous conversations
- **Memory Usage**: Efficient template and conversation caching
- **Database Performance**: Quick FAQ and template lookups

## Coverage Goals

- **Unit Tests**: 90%+ code coverage
- **Integration Tests**: All critical conversation flows
- **E2E Tests**: Complete user journeys
- **Error Scenarios**: Graceful degradation and recovery

## Test Environment Setup

### Environment Variables

Tests use these environment variables:

```bash
NODE_ENV=test
PAGE_ACCESS_TOKEN=test_token_12345
VERIFY_TOKEN=test_verify_token
APP_SECRET=test_app_secret
GEMINI_API_KEY=test_gemini_key
DB_PATH=:memory:
PORT=3001
```

### Database

Tests use in-memory SQLite database for fast, isolated testing.

### External APIs

All external API calls (Facebook, Gemini) are mocked in tests.

## Writing New Tests

### Unit Test Template

```javascript
const { functionToTest } = require('../../src/module');
const { mockData } = require('../fixtures/testData');

describe('Module Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle expected input correctly', () => {
    const result = functionToTest(mockData.input);
    expect(result).toEqual(mockData.expectedOutput);
  });

  test('should handle Singapore context', () => {
    const singlishInput = 'Wah very nice leh!';
    const result = functionToTest(singlishInput);
    expect(result).toContain('Singapore-appropriate response');
  });
});
```

### Integration Test Template

```javascript
const request = require('supertest');
const app = require('../../src/index');

describe('Feature Integration', () => {
  test('should handle complete flow', async () => {
    const response = await request(app)
      .post('/webhook')
      .send(webhookPayload)
      .expect(200);
    
    // Verify flow completion
    expect(response.body).toMatchObject(expectedResponse);
  });
});
```

## Debugging Tests

### Verbose Output

```bash
npm run test:unit -- --verbose
npm run test:integration -- --verbose
```

### Debug Specific Test

```bash
npx jest tests/unit/promotionHandler.test.js --detectOpenHandles --forceExit
```

### Coverage Analysis

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Continuous Integration

Tests are designed to run in CI/CD environments:

- **GitHub Actions**: Automated test runs on PR
- **Performance Monitoring**: Benchmark tracking
- **Coverage Reporting**: Automated coverage reports
- **Error Alerting**: Failed test notifications

## Contributing

When adding new features:

1. Write unit tests first (TDD approach)
2. Add integration tests for new flows
3. Update E2E tests for user-facing changes
4. Include Singapore-specific test cases
5. Ensure 90%+ test coverage
6. Update this README if needed

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure test database is using `:memory:`
   - Check environment variables

2. **API Mock Failures**
   - Verify axios mocks in setup.js
   - Check Facebook API mock responses

3. **Timeout Issues**
   - Increase timeout in jest.config
   - Optimize test performance

4. **Singapore Context Issues**
   - Verify Singlish test data
   - Check housing context mocks

### Getting Help

- Check existing test patterns
- Review mock data in fixtures/
- Consult team documentation
- Ask in team chat for testing help