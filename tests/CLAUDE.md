# Tests Directory - CLAUDE.md

Comprehensive test suite for the ESSEN Facebook Messenger Bot, covering unit tests, integration tests, and end-to-end testing.

## Structure

```
tests/
├── unit/                     # Unit tests for individual components
│   ├── promotionHandler.test.js
│   ├── humanLikeConversation.test.js
│   └── faqHandler.test.js
├── integration/              # Integration tests for component interaction
│   └── conversationFlow.test.js
├── e2e/                      # End-to-end tests for complete workflows
│   └── promotionJourney.test.js
├── fixtures/                 # Test data and mock objects
│   └── testData.js
├── setup.js                  # Test environment setup
├── loadTest.js               # Performance and load testing
└── README.md                 # Testing documentation
```

## Testing Framework

- **Jest**: Primary testing framework for unit and integration tests
- **Playwright**: End-to-end testing for web interfaces and bot interactions
- **Supertest**: HTTP assertion library for API testing
- **Mock/Stub Libraries**: For isolating components during testing

## Test Categories

### Unit Tests (`unit/`)

#### `promotionHandler.test.js`
Tests the promotion handling system:
- Promotion detection and parsing
- Discount calculations
- Promotional message generation
- Validation of promotional codes
- Edge cases and error handling

#### `humanLikeConversation.test.js`
Tests conversational AI features:
- Natural language processing
- Context understanding
- Response generation quality
- Conversation flow management
- Personality consistency

#### `faqHandler.test.js`
Tests FAQ (Frequently Asked Questions) handling:
- Question matching algorithms
- Answer retrieval accuracy
- Fallback mechanisms
- Knowledge base integration
- Multi-language support (Singlish)

### Integration Tests (`integration/`)

#### `conversationFlow.test.js`
Tests complete conversation workflows:
- Multi-turn conversations
- Context preservation across messages
- Command processing within conversations
- Database integration for conversation history
- Error recovery and graceful degradation

### End-to-End Tests (`e2e/`)

#### `promotionJourney.test.js`
Tests complete promotional customer journeys:
- User discovers promotion
- Inquires about details
- Proceeds through sales funnel
- Completes appointment booking
- Receives confirmation and follow-up

### Test Fixtures (`fixtures/`)

#### `testData.js`
Centralized test data and mock objects:
- Sample user profiles
- Mock conversation histories
- Product catalog test data
- Facebook API response mocks
- Gemini AI response mocks

## Test Configuration

### `setup.js`
Global test environment configuration:
- Database connection setup for testing
- Environment variable configuration
- Global mocks and stubs
- Test timeout configurations
- Cleanup procedures

### `jest.config.js` (implied)
Jest configuration for the test suite:
- Test file patterns
- Coverage thresholds
- Module path mapping
- Transform configurations
- Setup and teardown scripts

### `playwright.config.js`
Playwright configuration for E2E tests:
- Browser configurations
- Test environments (dev/staging)
- Parallel execution settings
- Retry policies
- Screenshot and video recording

## Performance Testing

### `loadTest.js`
Load and performance testing:
- Concurrent user simulation
- Response time measurement
- Throughput testing
- Memory usage monitoring
- Database performance under load

## Test Data Management

### Mock Data Strategy
- **Realistic Data**: Test data mirrors production scenarios
- **Edge Cases**: Includes boundary conditions and error cases  
- **Multilingual**: Singapore context and Singlish examples
- **Privacy Compliant**: No real user data in test fixtures

### Database Testing
- **Isolated Environment**: Separate test database
- **Transaction Rollback**: Tests don't affect each other
- **Seed Data**: Consistent starting state for tests
- **Migration Testing**: Schema changes are tested

## Coverage Requirements

### Coverage Targets
- **Unit Tests**: 90%+ code coverage
- **Integration Tests**: 80%+ feature coverage
- **E2E Tests**: 100% critical path coverage

### Coverage Areas
- Core conversation logic
- Facebook API integration
- Gemini AI integration
- Database operations
- Error handling paths
- Authentication and authorization

## Testing Commands

### Running Tests
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration  

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run load tests
npm run test:load

# Watch mode for development
npm run test:watch
```

### Test Scripts Integration
```bash
# Run via project scripts
./scripts/test-local.sh           # Local comprehensive testing
node scripts/test-essen-bot.js    # Bot-specific testing
node scripts/test-appointment.js  # Appointment flow testing
```

## Test Environment Setup

### Environment Variables
```env
NODE_ENV=test
TEST_DB_PATH=./database/test.db
TEST_DATABASE_URL=postgresql://test_user:password@localhost/test_db
FACEBOOK_TEST_TOKEN=test_token
GEMINI_TEST_API_KEY=test_key
```

### Prerequisites
- Test database (SQLite or PostgreSQL)
- Mock Facebook webhook endpoints
- Gemini AI test environment
- Browser installations for Playwright

## Best Practices

### Test Writing Guidelines
1. **Descriptive Names**: Clear test case descriptions
2. **Arrange-Act-Assert**: Structured test organization
3. **Isolation**: Tests don't depend on each other
4. **Fast Execution**: Quick feedback loop
5. **Maintainable**: Easy to update when features change

### Mock Strategy
- **External APIs**: Mock Facebook and Gemini APIs
- **Database**: Use test database with transactions
- **Time-dependent**: Mock date/time for consistency
- **Random Data**: Seed random generators for reproducibility

### Assertion Guidelines
- **Specific Assertions**: Test exact expected behavior
- **Error Cases**: Verify error handling
- **Side Effects**: Check database changes
- **Performance**: Assert response times
- **Security**: Validate input sanitization

## Continuous Integration

### GitHub Actions Integration
- Tests run on every pull request
- Multiple Node.js versions tested
- Database migrations tested
- Coverage reports generated
- E2E tests on staging environment

### Test Reporting
- JUnit XML for CI integration
- HTML coverage reports
- Performance benchmarks
- Test result notifications
- Failure analysis and debugging info

## Debugging Tests

### Debug Configuration
- VS Code debug configurations
- Chrome DevTools for E2E tests
- Verbose logging in test mode
- Screenshot capture on failures
- Video recording for E2E failures

### Common Issues
- **Timing Issues**: Async operation testing
- **Database State**: Test isolation problems
- **API Rate Limits**: Mock service limitations
- **Environment Differences**: Local vs CI inconsistencies
- **Flaky Tests**: Non-deterministic behavior

## Future Enhancements

### Planned Improvements
- Visual regression testing
- API contract testing
- Security vulnerability scanning
- Accessibility testing
- Cross-browser E2E testing
- Mobile device testing