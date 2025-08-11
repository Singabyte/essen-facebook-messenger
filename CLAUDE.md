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
- `node scripts/test-appointment.js` - Test appointment booking functionality
- `./scripts/test-local.sh` - Run local tests

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
│   └── webhook.js                # Facebook webhook handler
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
- **Express Server** (`src/index.js`): Main entry point, initializes database and Facebook features
- **Webhook Handler** (`src/webhook.js`, `src/webhook-enhanced.js`): Handles Facebook webhook verification and message routing
- **Message Handler** (`src/messageHandler.js`): Processes incoming messages, manages commands, generates responses
- **Gemini Integration** (`src/geminiClient.js`): Integrates with Google's Gemini AI, loads ESSEN knowledge base
- **Database** (`src/database.js`, `src/database-pg.js`): SQLite/PostgreSQL database for conversations, users, preferences, and analytics
- **Facebook Integration** (`src/facebook-integration.js`): Facebook-specific features and API calls
- **Admin Socket Client** (`src/admin-socket-client.js`): Socket.io client for real-time admin interface updates

#### Admin Interface
- **React Frontend** (`admin-interface/client`): Vite-based React app with Material-UI
- **Express Backend** (`admin-interface/server`): RESTful API with JWT authentication
- **Features**: Dashboard, user management, conversation viewer, knowledge base editor, appointment management, analytics

### Knowledge Base
- `essen-chatbot-kb.md` - ESSEN product catalog, services, and company information
- `essen-chatbot-sg-examples.md` - Singapore context and language examples (Singlish-aware)

### Key Features
1. **Command System**: Handles commands like `/help`, `/products`, `/showroom`, `/consultation`, `/bestsellers`, `/clear`, `/about`
2. **Contextual AI**: Uses conversation history and ESSEN knowledge base for context-aware responses
3. **Quick Replies**: Dynamic suggestions based on conversation context
4. **Singapore Context**: Understands HDB, BTO, condo references and local expressions (Singlish-aware)
5. **Appointment Booking**: Stateful appointment booking flow with validation (11am-7pm operating hours)

### Database Schema
- `users` - Facebook user information
- `conversations` - Message history with timestamps
- `user_preferences` - User settings and preferences
- `analytics` - Event tracking for monitoring
- `appointments` - Appointment bookings with user details

### Environment Variables
Required in `.env`:
- `PAGE_ACCESS_TOKEN` - Facebook Page access token
- `VERIFY_TOKEN` - Webhook verification token
- `APP_SECRET` - Facebook App secret (CRITICAL for webhook signature verification)
- `GEMINI_API_KEY` - Google Gemini API key
- `PORT` - Server port (default: 3000)
- `DB_PATH` - SQLite database path
- `DATABASE_URL` - PostgreSQL connection string (for production)

Note: The Facebook error about `pages_manage_metadata` permission is normal - basic messaging functionality works without it.

Admin interface (`admin-interface/server/.env`):
- `JWT_SECRET` - Secret for JWT tokens
- `PORT` - Admin API port (default: 4000)
- `DB_PATH` - Path to bot database
- `DATABASE_URL` - PostgreSQL connection string

## Important Implementation Details

### Message Flow
1. Facebook webhook receives message at `/webhook`
2. Webhook handler verifies signature and routes to messageHandler
3. MessageHandler processes commands or generates AI response
4. Response includes context-aware quick replies
5. All interactions are logged in database

### ESSEN-Specific Context
- The bot is trained with extensive ESSEN product knowledge
- Understands Singapore housing types (HDB, BTO, condo)
- Recognizes local language patterns (Singlish)
- Provides showroom location and operating hours
- Handles product inquiries with specific details from knowledge base

### Error Handling
- All database operations have error handling
- Facebook API calls include retry logic
- Webhook signature verification prevents unauthorized access
- Graceful error messages sent to users on failures