# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with nodemon (auto-reload)
- `npm start` - Start production server

### Testing
- `node scripts/test-essen-bot.js` - Test ESSEN-specific bot responses
- `./scripts/test-local.sh` - Run local tests

### Deployment
- `./scripts/deploy.sh` - Deploy to production
- `pm2 start ecosystem.config.js` - Start with PM2
- `pm2 logs facebook-bot` - View PM2 logs

### Monitoring & Maintenance
- `./scripts/monitor.sh` - Monitor bot health
- `./scripts/backup.sh` - Backup database

## Architecture

### Core Components
- **Express Server** (`src/index.js`): Main entry point, initializes database and Facebook features
- **Webhook Handler** (`src/webhook.js`, `src/webhook-enhanced.js`): Handles Facebook webhook verification and message routing
- **Message Handler** (`src/messageHandler.js`): Processes incoming messages, manages commands, generates responses
- **Gemini Integration** (`src/geminiClient.js`): Integrates with Google's Gemini AI, loads ESSEN knowledge base
- **Database** (`src/database.js`): SQLite database for conversations, users, preferences, and analytics
- **Facebook Integration** (`src/facebook-integration.js`): Facebook-specific features and API calls

### Knowledge Base
- `essen-chatbot-kb.md` - ESSEN product catalog, services, and company information
- `essen-chatbot-sg-examples.md` - Singapore context and language examples (Singlish-aware)

### Key Features
1. **Command System**: Handles commands like `/help`, `/products`, `/showroom`, `/consultation`, `/bestsellers`
2. **Contextual AI**: Uses conversation history and ESSEN knowledge base for context-aware responses
3. **Quick Replies**: Dynamic suggestions based on conversation context
4. **Singapore Context**: Understands HDB, BTO, condo references and local expressions

### Database Schema
- `users` - Facebook user information
- `conversations` - Message history with timestamps
- `user_preferences` - User settings and preferences
- `analytics` - Event tracking for monitoring

### Environment Variables
Required in `.env`:
- `PAGE_ACCESS_TOKEN` - Facebook Page access token
- `VERIFY_TOKEN` - Webhook verification token
- `APP_SECRET` - Facebook App secret
- `GEMINI_API_KEY` - Google Gemini API key
- `PORT` - Server port (default: 3000)
- `DB_PATH` - SQLite database path