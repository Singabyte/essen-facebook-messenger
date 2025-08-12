# Source Directory - CLAUDE.md

Core source code for the ESSEN Facebook Messenger Bot application.

## Structure

```
src/
├── database-pg.js            # PostgreSQL database layer
├── geminiClient.js           # Google Gemini AI integration
├── index.js                  # Main application entry point
├── messageHandler.js         # Core message processing logic
└── webhook.js                # Facebook webhook handler
```

## Core Components

### `index.js` - Application Entry Point
**Purpose**: Main server initialization and configuration

**Key Responsibilities**:
- Express server setup and configuration
- Database connection initialization
- Route registration (webhook, health checks)
- Environment variable validation
- Graceful shutdown handling
- Process monitoring setup

**Key Features**:
- Port configuration (default: 3000)
- Health check endpoint (`/health`)
- Static file serving for documentation
- Error handling middleware
- CORS configuration for admin interface
- Process signal handling (SIGTERM, SIGINT)

### `webhook.js` - Facebook Webhook Handler
**Purpose**: Handles Facebook Messenger webhook events

**Key Responsibilities**:
- Webhook verification (GET requests)
- Message event processing (POST requests)
- Security signature validation
- Request routing to message handler
- Error response handling

**Security Features**:
- App Secret signature verification
- Token validation for webhook setup
- Rate limiting protection
- Malformed request handling

**Supported Events**:
- `messages` - Incoming user messages
- `messaging_postbacks` - Button/quick reply interactions
- `messaging_referrals` - Referral tracking
- `messaging_handovers` - Live chat handovers

### `messageHandler.js` - Core Message Processing
**Purpose**: Central message processing and response generation

**Key Responsibilities**:
- Message parsing and analysis
- AI response generation via Gemini
- Quick reply suggestion generation
- Conversation context management
- User preference handling

**AI Integration**:
- Gemini AI for natural language processing
- ESSEN knowledge base integration
- Context-aware response generation
- Singapore/Singlish language support
- Conversation memory management

**Features**:
- Multi-turn conversation support
- User intent recognition
- Product inquiry handling
- Error recovery and fallback responses

### `geminiClient.js` - Google Gemini AI Integration
**Purpose**: Interface with Google's Gemini AI for intelligent responses

**Key Responsibilities**:
- Gemini API client configuration
- Knowledge base loading and management
- Prompt engineering and optimization
- Response processing and formatting
- Error handling and fallback logic

**Knowledge Base Integration**:
- ESSEN product catalog (`essen-chatbot-kb.md`)
- Singapore context examples (`essen-chatbot-sg-examples.md`)
- Dynamic knowledge base reloading
- Context-aware prompt generation

**AI Configuration**:
- Model selection (Gemini Pro/Flash)
- Temperature and creativity settings
- Token limit management
- Response filtering and safety
- Conversation history integration

**Performance Features**:
- Response caching for common queries
- Batch processing for multiple requests
- Rate limiting compliance
- Timeout handling
- Retry logic for failed requests

### `database-pg.js` - PostgreSQL Database Layer
**Purpose**: Database abstraction layer for PostgreSQL operations

**Key Responsibilities**:
- Database connection management
- SQL query execution and optimization
- Transaction handling
- Data validation and sanitization
- Migration support

**Database Schema**:
```sql
-- Users table
users (
  facebook_id, name, profile_pic_url, 
  first_interaction, last_interaction,
  message_count, preferences
)

-- Conversations table  
conversations (
  id, facebook_id, message_text, sender,
  timestamp, message_type, metadata
)

-- User preferences
user_preferences (
  facebook_id, language, notification_settings,
  interests, contact_preferences
)

-- Analytics tracking
analytics (
  id, event_type, user_id, event_data,
  timestamp, session_id
)

```

**Connection Features**:
- Connection pooling for performance
- Automatic reconnection handling
- SSL configuration for production
- Environment-based configuration
- Health check queries

**Query Optimization**:
- Prepared statements for security
- Indexed queries for performance
- Batch operations for efficiency
- Transaction management
- Query logging for debugging

## Data Flow

### Incoming Message Processing
1. Facebook sends webhook POST to `/webhook`
2. `webhook.js` verifies signature and extracts message
3. `messageHandler.js` receives and analyzes message
4. AI processing via `geminiClient.js`
5. Response generation with knowledge base context
6. Database logging via `database-pg.js`
7. Response sent back to Facebook API

### Database Interactions
1. User message stored in `conversations` table
2. User profile updated in `users` table
3. Analytics events logged in `analytics` table
4. Preferences checked/updated in `user_preferences`

## Environment Configuration

### Required Environment Variables
```env
# Facebook Integration
PAGE_ACCESS_TOKEN=your_page_access_token
VERIFY_TOKEN=your_verify_token  
APP_SECRET=your_app_secret

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Database
DATABASE_URL=postgresql://user:pass@host:port/db
DB_PATH=./database/bot.db  # SQLite fallback

# Server
PORT=3000
NODE_ENV=production
```

### Configuration Validation
- Startup checks for required variables
- Database connection testing
- API key validation
- Graceful degradation for missing components

## Error Handling Strategy

### Application Level
- Global error handlers for uncaught exceptions
- Promise rejection handling
- Graceful service degradation
- User-friendly error messages

### Component Level
- Facebook API error handling
- Gemini AI service failures
- Database connection errors
- Invalid message format handling

### Logging and Monitoring
- Structured logging with timestamps
- Error categorization and severity
- Performance metrics tracking
- Health check endpoints

## Security Measures

### Input Validation
- Facebook signature verification
- Message content sanitization
- SQL injection prevention
- XSS protection

### Authentication
- Facebook App Secret verification
- Webhook token validation
- Database connection encryption
- API key protection

### Rate Limiting
- Facebook API rate limit compliance
- Gemini API quota management
- Database connection throttling
- User message rate limiting

## Performance Optimizations

### Database
- Connection pooling
- Query optimization with indexes
- Batch operations for bulk data
- Read replicas for analytics queries

### AI Processing
- Response caching for common queries
- Batch processing where possible
- Timeout management
- Fallback responses for failures

### Memory Management
- Conversation history pruning
- Cache size limitations
- Garbage collection optimization
- Resource cleanup on shutdown

## Development Guidelines

### Code Organization
- Single responsibility principle
- Clear separation of concerns
- Consistent error handling patterns
- Comprehensive logging

### Testing Strategy
- Unit tests for individual functions
- Integration tests for component interaction
- Mocking external services
- Database transaction testing

### Documentation
- JSDoc comments for functions
- Clear variable and function naming
- README files for complex logic
- API documentation maintenance