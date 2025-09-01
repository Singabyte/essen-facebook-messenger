# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with nodemon (auto-reload)
- `npm start` - Start production server

### Admin Interface
- `cd admin-interface/server && npm run dev` - Start admin backend (port 4000)
- `cd admin-interface/client && npm run dev` - Start admin frontend (port 5173)
- `node admin-interface/server/create-admin-pg.js` - Create admin user (PostgreSQL)

### Testing
- `node scripts/test-essen-bot.js` - Test ESSEN-specific bot responses
- `./scripts/test-local.sh` - Run local tests
- `node scripts/test-instagram.js` - Test Instagram webhook integration
- `node scripts/verify-instagram-webhook.js` - Verify Instagram webhook configuration
- `node scripts/get-instagram-id.js` - Find Instagram Business Account ID
- `node scripts/subscribe-instagram-webhook.js` - Subscribe Instagram to webhooks

### Deployment
- `./scripts/deploy.sh` - Deploy to production
- `pm2 start ecosystem.config.js` - Start with PM2
- `pm2 logs facebook-bot` - View PM2 logs

### Monitoring & Maintenance
- `./scripts/monitor.sh` - Monitor bot health
- `./scripts/backup.sh` - Backup database
- `pm2 status` - Check PM2 process status
- `pm2 restart facebook-bot` - Restart the bot

## File Structure

```
essen-facebook-messenger/
├── .claude/                        # Claude Code settings and agents
│   ├── settings.local.json         # Local Claude settings
│   └── agents/                     # Specialized agents for different tasks
├── .do/                           # DigitalOcean deployment configs
├── .github/workflows/             # GitHub Actions CI/CD workflows
├── admin-interface/               # Admin dashboard for bot management
│   ├── client/                    # React frontend (Vite + Material-UI)
│   │   ├── src/
│   │   │   ├── components/        # Reusable React components
│   │   │   ├── context/           # React context providers
│   │   │   ├── hooks/             # Custom React hooks
│   │   │   ├── pages/             # Page components
│   │   │   ├── services/          # API service functions
│   │   │   ├── styles/            # Styling files
│   │   │   └── utils/             # Utility functions
│   │   ├── public/                # Static assets
│   │   └── routes/                # Route configurations
│   └── server/                    # Express backend API
│       ├── src/
│       │   ├── db/                # Database connections and queries
│       │   ├── middleware/        # Express middleware
│       │   └── routes/            # API route handlers
│       └── scripts/               # Server utility scripts
├── config/                        # Configuration files
├── database/                      # Database files and migrations
├── logs/                          # Application logs
├── monitoring/                    # Monitoring configurations
├── scripts/                       # Utility and deployment scripts
├── sql/                          # SQL scripts and migrations
├── src/                          # Main bot application source
│   ├── database-pg.js            # PostgreSQL database layer
│   ├── geminiClient.js           # Google Gemini AI integration
│   ├── index.js                  # Main application entry point
│   ├── messageHandler.js         # Core message processing logic
│   ├── webhook.js                # Facebook & Instagram webhook handler
│   └── platform-adapter.js       # Platform-specific message handling (Facebook/Instagram)
├── tests/                        # Test suites
│   ├── e2e/                      # End-to-end tests
│   ├── fixtures/                 # Test data and fixtures
│   ├── integration/              # Integration tests
│   └── unit/                     # Unit tests
├── essen-chatbot-kb.md           # ESSEN knowledge base
├── essen-chatbot-sg-examples.md  # Singapore context examples
├── app.yaml                      # App platform deployment config
├── ecosystem.config.js           # PM2 process configuration
├── package.json                  # Node.js dependencies and scripts
└── playwright.config.js          # E2E testing configuration
```

## Architecture

### Core Components

#### Bot Application
- **Express Server** (`src/index.js`): Main entry point, initializes database and Facebook/Instagram features
- **Webhook Handler** (`src/webhook.js`): Handles Facebook & Instagram webhook verification and message routing
- **Message Handler** (`src/messageHandler.js`): Processes incoming messages and generates responses
- **Platform Adapter** (`src/platform-adapter.js`): Handles platform-specific (Facebook/Instagram) message sending and user profiles
- **Gemini Integration** (`src/geminiClient.js`): Integrates with Google's Gemini AI, loads ESSEN knowledge base
- **Database** (`src/database-pg.js`): PostgreSQL database for conversations, users, preferences, and analytics
- **Admin Socket Client** (`src/admin-socket-client.js`): Socket.io client for real-time admin interface updates

#### Admin Interface
- **React Frontend** (`admin-interface/client`): Vite-based React app with Material-UI
- **Express Backend** (`admin-interface/server`): RESTful API with JWT authentication
- **Features**: Dashboard with key metrics, user management, conversation viewer, knowledge base editor, analytics

### Knowledge Base
- `essen-chatbot-kb.md` - ESSEN product catalog, services, and company information
- `essen-chatbot-sg-examples.md` - Singapore context and language examples (Singlish-aware)

### Key Features
1. **Contextual AI**: Uses conversation history and ESSEN knowledge base for context-aware responses
2. **Multi-Platform Support**: Handles both Facebook Messenger and Instagram Direct Messages
3. **Quick Replies**: Dynamic suggestions based on conversation context
4. **Singapore Context**: Understands HDB, BTO, condo references and local expressions (Singlish-aware)

### Database Schema
- `users` - Facebook/Instagram user information (includes platform field)
- `conversations` - Message history with timestamps and platform tracking
- `user_preferences` - User settings and preferences
- `analytics` - Event tracking for monitoring

### Environment Variables
Required in `.env`:
- `PAGE_ACCESS_TOKEN` - Facebook Page access token
- `VERIFY_TOKEN` - Webhook verification token
- `APP_SECRET` - Facebook App secret (CRITICAL for webhook signature verification)
- `GEMINI_API_KEY` - Google Gemini API key
- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string (for production)

Instagram-specific (required for Instagram integration):
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` - Instagram Business Account ID (e.g., 17841467073360819)
- `INSTAGRAM_PAGE_ACCESS_TOKEN` - Page Access Token with Instagram permissions
- `INSTAGRAM_ID` - Instagram App ID (optional, for reference)
- `INSTAGRAM_SECRET` - Instagram App Secret (optional)
- `INSTAGRAM_ACCESS_TOKEN` - Instagram-specific access token (optional, fallback)

Note: The Facebook error about `pages_manage_metadata` permission is normal - basic messaging functionality works without it.

Admin interface (`admin-interface/server/.env`):
- `JWT_SECRET` - Secret for JWT tokens
- `PORT` - Admin API port (default: 4000)
- `DB_PATH` - Path to bot database
- `DATABASE_URL` - PostgreSQL connection string

## Important Implementation Details

### Message Flow
1. Facebook/Instagram webhook receives message at `/webhook`
2. Webhook handler detects platform (Facebook or Instagram) and routes accordingly
3. Platform adapter handles platform-specific message formatting
4. MessageHandler processes message and generates AI response
5. Response includes context-aware quick replies (Facebook only, Instagram doesn't support)
6. All interactions are logged in database with platform information

### ESSEN-Specific Context
- The bot is trained with extensive ESSEN product knowledge
- Understands Singapore housing types (HDB, BTO, condo)
- Recognizes local language patterns (Singlish)
- Provides showroom location and operating hours
- Handles product inquiries with specific details from knowledge base

### Error Handling
- All database operations have error handling
- Facebook API calls include retry logic
- Webhook signature verification prevents unauthorized access (skipped for Instagram)
- Graceful error messages sent to users on failures

## Instagram Integration

### Prerequisites
1. **Instagram Business/Creator Account**: Your Instagram account must be a Business or Creator account
2. **Facebook Page Connection**: Instagram account must be connected to a Facebook Page
3. **Meta Business Suite**: Access to Meta Business Suite for configuration
4. **App Permissions**: Your app needs `instagram_basic` and `instagram_manage_messages` permissions

### Setup Process
1. **Connect Instagram to Facebook Page**:
   - Go to Meta Business Suite → Settings → Accounts → Instagram accounts
   - Connect your Instagram Business Account to your Facebook Page

2. **Generate Instagram-enabled Token**:
   - Use Facebook Graph API Explorer
   - Select permissions: `pages_messaging`, `instagram_basic`, `instagram_manage_messages`
   - Generate token and save as `INSTAGRAM_PAGE_ACCESS_TOKEN`

3. **Find Instagram Business Account ID**:
   ```bash
   node scripts/get-instagram-id.js
   ```
   This will display your Instagram Business Account ID (17-18 digits)

4. **Subscribe to Webhooks**:
   ```bash
   node scripts/subscribe-instagram-webhook.js
   ```

5. **Verify Configuration**:
   ```bash
   node scripts/verify-instagram-webhook.js
   ```

### Instagram Webhook Specifics

#### Webhook Object Types
- Instagram messages can come through `object: 'instagram'` OR `object: 'page'`
- The bot automatically detects Instagram messages by:
  - Entry ID matching Instagram Business Account ID
  - Sender ID format (17+ digits)
  - Platform-specific fields

#### Message Format Differences
- Instagram messages may arrive in different formats:
  - Standard `messaging` array (like Facebook)
  - `changes` array with `messages` field (WhatsApp-style)
  - Direct message format

#### Signature Verification
- Instagram webhooks use a different signature format than Facebook
- Signature verification is automatically skipped for Instagram webhooks
- This is normal and expected behavior

#### Feature Limitations
Instagram doesn't support all Facebook Messenger features:
- ✅ Text messages
- ✅ Image attachments
- ✅ Read receipts
- ❌ Quick replies (not supported)
- ❌ Persistent menu (not supported)
- ❌ Templates (not supported)

### Testing Instagram Integration
1. **Local Testing**:
   ```bash
   node scripts/test-instagram.js
   ```

2. **Send Test Message**:
   - Open Instagram app
   - Send message to your business account (@essen.sg)
   - Check server logs for webhook events

3. **Debug Endpoints**:
   - `/debug/webhooks` - View recent webhook events
   - `/debug/health-quick` - Check service health

### Common Issues & Solutions

#### "Invalid OAuth access token"
- **Cause**: Using wrong token or missing Instagram permissions
- **Solution**: Regenerate token with Instagram permissions

#### "Object with ID does not exist"
- **Cause**: Using App ID instead of Instagram Business Account ID
- **Solution**: Use `get-instagram-id.js` to find correct ID

#### No webhooks received
- **Cause**: Instagram not connected to Facebook Page
- **Solution**: Connect in Meta Business Suite

#### Signature verification fails
- **Expected**: Instagram uses different signature format
- **Solution**: Already handled - signature verification skipped for Instagram

#### User must message first
- **Limitation**: You can only reply to users who have messaged you first
- **Solution**: This is an Instagram API restriction - inform users to message first