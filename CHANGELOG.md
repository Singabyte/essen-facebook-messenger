# Changelog

All notable changes to the ESSEN Facebook Messenger Bot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2025-01-11

### Added
- **Admin Messaging Features**: Admins can now send messages directly to users through the admin interface
- **Bot Control Per User**: Added ability to enable/disable bot responses for specific users
- **Admin Takeover Mode**: Admins can take over conversations, temporarily disabling bot responses
- **Real-time Conversation Monitoring**: Live conversation updates via WebSocket in admin interface
- **User Profile Fetching**: Automatic fetching of user profile pictures and names from Facebook API
- **Database Migration System**: Added SQL migration scripts for schema updates
- **Admin Message Tracking**: Database now tracks which admin sent messages and when

### Fixed
- **Database SSL Connection**: Fixed PostgreSQL SSL certificate error in production
  - Added proper SSL configuration for DigitalOcean managed databases
  - Set `NODE_TLS_REJECT_UNAUTHORIZED` for self-signed certificates
  - Created centralized database configuration module
  - Added connection string parsing for better SSL handling
- **Socket.io Connection in Production**: Fixed WebSocket connection path for DigitalOcean deployment
  - Client now properly connects with `/api/socket.io/` path in production
  - Server CORS configuration updated to handle production URLs
- **Conversation History Loading**: Fixed nullable column handling in database queries
  - Added COALESCE for `is_from_user`, `is_admin_message`, and `admin_id` columns
  - Ensures backward compatibility with existing data
- **Environment Configuration**: Updated app.yaml with proper Socket.io paths for production

### Changed
- **Database Schema Updates**:
  - Added `bot_enabled` column to users table (default: true)
  - Added `admin_takeover` column to users table (default: false)  
  - Added `admin_takeover_at` timestamp column
  - Added `admin_takeover_by` column to track admin ID
  - Added `is_admin_message` column to conversations table
  - Added `admin_id` column to conversations table
  - Created indexes for performance optimization

### Technical Improvements
- **WebSocket Architecture**: Improved real-time communication between bot, admin server, and clients
- **Error Handling**: Enhanced error handling for Facebook API calls and database operations
- **Query Optimization**: Added database indexes for faster bot status lookups
- **CORS Configuration**: Improved cross-origin resource sharing for production environment

## [1.5.0] - 2024-12-15

### Added
- **Admin Dashboard**: Complete admin interface for bot management
- **Analytics System**: Comprehensive analytics for bot usage and performance
- **Appointment Management**: Admin interface for managing customer appointments
- **Knowledge Base Editor**: UI for editing bot responses and product information

### Changed
- **Database**: Migrated from SQLite to PostgreSQL for production
- **Deployment**: Moved to DigitalOcean App Platform

## [1.4.0] - 2024-11-30

### Added
- **Human-like Conversation**: Natural typing delays and response patterns
- **Template System**: Reusable message templates for common responses
- **Promotion Handling**: Special handling for promotional content
- **FAQ System**: Automated responses for frequently asked questions

### Fixed
- **Memory Management**: Improved conversation history management
- **Rate Limiting**: Better handling of Facebook API rate limits

## [1.3.0] - 2024-11-15

### Added
- **Singapore Context**: Enhanced Singlish language support
- **Product Recommendations**: AI-powered product suggestions
- **Quick Replies**: Context-aware quick reply suggestions
- **Appointment Booking**: Complete appointment booking workflow

### Changed
- **AI Model**: Upgraded to latest Gemini model
- **Knowledge Base**: Expanded ESSEN product catalog

## [1.2.0] - 2024-10-30

### Added
- **Command System**: Slash commands for quick access to features
- **User Preferences**: Persistent user preferences and settings
- **Analytics Tracking**: Basic event tracking for monitoring

### Fixed
- **Webhook Verification**: Improved Facebook webhook signature verification
- **Error Messages**: More user-friendly error messages

## [1.1.0] - 2024-10-15

### Added
- **Gemini AI Integration**: Connected Google Gemini for intelligent responses
- **Conversation History**: Database storage for conversation tracking
- **User Management**: Basic user profile management

### Changed
- **Database Structure**: Improved schema for better performance

## [1.0.0] - 2024-10-01

### Added
- **Initial Release**: Basic Facebook Messenger bot functionality
- **Webhook Integration**: Facebook webhook for receiving messages
- **Basic Commands**: Help, products, showroom information
- **SQLite Database**: Local database for development

### Security
- **Environment Variables**: Secure storage of API keys and tokens
- **HTTPS Only**: Enforced secure connections

---

## Migration Notes

### For v1.5.0+ (Admin Messaging Features)
1. Run the database migration script:
   ```bash
   node scripts/apply-bot-control-migration.js
   ```
2. Restart both bot and admin services
3. Update environment variables in app.yaml if needed

### For v1.4.0+ (PostgreSQL Migration)
1. Run migration script:
   ```bash
   node scripts/migrate-to-postgresql.js
   ```
2. Update DATABASE_URL environment variable
3. Test database connectivity before deployment

## Deployment Instructions

### DigitalOcean App Platform
1. Push changes to main branch
2. DigitalOcean automatically deploys on push
3. Monitor deployment at: https://cloud.digitalocean.com/apps

### Manual Deployment
```bash
./scripts/deploy.sh
```

## Support

For issues or questions:
- Create an issue on GitHub
- Contact the development team
- Check documentation in /docs folder