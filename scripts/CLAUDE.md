# Scripts Directory - CLAUDE.md

This directory contains utility scripts for deployment, testing, monitoring, and maintenance of the ESSEN Facebook Messenger Bot.

## Structure

```
scripts/
├── deploy.sh                     # Main deployment script
├── setup.sh                      # Initial project setup
├── monitor.sh                    # Health monitoring
├── backup.sh                     # Database backup
├── test-*.js                     # Testing scripts
├── debug-*.js                    # Debugging utilities  
├── create-admin-*.js             # Admin user creation
├── verify-*.js                   # Verification scripts
├── migrate-*.js                  # Database migration
└── init-*.js                     # Initialization scripts
```

## Deployment Scripts

### `deploy.sh`
Main deployment script for production environments:
- Pulls latest code from repository
- Installs/updates dependencies  
- Runs database migrations
- Updates knowledge base files
- Restarts services with PM2
- Verifies deployment success

### `server-setup.sh`
Initial server setup for new environments:
- Installs Node.js and PM2
- Sets up database (PostgreSQL)
- Configures environment variables
- Sets up SSL certificates
- Configures firewall and security

### `digitalocean-setup.sh`
DigitalOcean-specific deployment configuration:
- App Platform deployment setup
- Environment variable configuration
- Database connection setup
- Domain and SSL configuration

### `post-deploy.sh`
Post-deployment verification and setup:
- Health check verification
- Database migration validation
- Service status confirmation
- Log rotation setup

## Testing Scripts

### `test-essen-bot.js`
Comprehensive bot functionality testing:
- Tests core conversation flows
- Validates ESSEN-specific responses
- Checks command handling
- Verifies knowledge base integration

### `test-appointment.js`
Appointment booking system testing:
- Tests booking flow end-to-end
- Validates time slot availability
- Checks form validation
- Tests confirmation and reminders

### `test-local.sh`
Local development testing suite:
- Runs unit tests
- Integration test execution
- Code linting and formatting
- Coverage report generation

### `test-integration.js`
Integration testing across all components:
- Database connectivity
- Facebook API integration
- Gemini AI integration
- Admin interface connectivity

### `test-webhook.js` / `test-webhook-production.js`
Webhook functionality testing:
- Facebook webhook verification
- Message processing validation
- Response time testing
- Error handling verification

### `test-database.js`
Database functionality testing:
- Connection testing
- CRUD operations validation
- Migration testing
- Performance benchmarking

### `test-facebook-api.js` / `test-facebook-api-production.js`
Facebook API integration testing:
- Authentication verification
- Message sending capabilities
- API rate limit handling
- Error response processing

## Monitoring & Debugging Scripts

### `monitor.sh`
Continuous health monitoring:
- Service status checking
- Database connection monitoring
- Response time measurement
- Error rate tracking
- Automated alerting

### `debug-production.js` / `debug-production-simple.js`
Production environment debugging:
- Live system diagnostics
- Performance profiling
- Error log analysis
- Database query optimization

### `setup-monitoring.js`
Monitoring system initialization:
- Sets up health check endpoints
- Configures logging infrastructure
- Initializes alert systems
- Sets up performance metrics

## Database Scripts

### `init-database.js`
Database initialization and setup:
- Creates required tables
- Sets up indexes
- Initializes default data
- Configures connection pooling

### `migrate-to-postgresql.js`
SQLite to PostgreSQL migration:
- Data export from SQLite
- Schema recreation in PostgreSQL
- Data import and validation
- Connection string updates

### `create-admin-user.sh` / `create-admin-user-pg.js` / `create-admin-digitalocean.sh`
Admin user creation for different environments:
- Interactive admin user creation
- Password hashing and storage
- Role and permission assignment
- Environment-specific configurations

### `backup.sh`
Automated database backup:
- PostgreSQL dump creation
- Backup file compression
- Remote backup storage
- Retention policy management

## Utility Scripts

### `verify-env.js`
Environment variable validation:
- Checks required variables
- Validates configuration formats
- Reports missing configurations
- Suggests fixes for issues

### `verify-deployment.sh` / `verify-deployment-do.sh`
Deployment verification:
- Service health checks
- Database connectivity validation
- API endpoint testing
- Integration verification

### `verify-integration.js`
Third-party integration verification:
- Facebook API connectivity
- Gemini AI service status
- Database connection health
- WebSocket functionality

### `test-kb-reload.js`
Knowledge base reload testing:
- Tests knowledge base updates
- Validates content parsing
- Checks reload mechanisms
- Verifies content consistency

### `copy-kb-files.js` (admin-interface/server/scripts/)
Knowledge base synchronization:
- Copies KB files between directories
- Ensures content consistency
- Updates timestamps
- Validates file integrity

## Analytics & Maintenance Scripts

### `fix-analytics-views.sql`
Analytics database maintenance:
- Fixes analytics table issues
- Updates indexes for performance
- Cleans up orphaned records
- Optimizes query performance

### `manual-fix-analytics.sh`
Manual analytics repair:
- Executes analytics fixes
- Validates data integrity
- Rebuilds corrupted indexes
- Generates health reports

## Usage Examples

### Development Testing
```bash
# Run comprehensive bot testing
node scripts/test-essen-bot.js

# Test appointment booking
node scripts/test-appointment.js

# Run local test suite
./scripts/test-local.sh
```

### Deployment
```bash
# Deploy to production
./scripts/deploy.sh

# Verify deployment
./scripts/verify-deployment.sh

# Create admin user
node scripts/create-admin-user-pg.js
```

### Monitoring
```bash
# Start monitoring
./scripts/monitor.sh

# Debug production issues
node scripts/debug-production.js

# Check system health
node scripts/verify-integration.js
```

### Database Management
```bash
# Initialize database
node scripts/init-database.js

# Create backup
./scripts/backup.sh

# Migrate to PostgreSQL
node scripts/migrate-to-postgresql.js
```

## Configuration

Most scripts use environment variables from `.env`:
- Database connection strings
- API keys and secrets
- Service endpoints
- Feature flags

Some scripts accept command-line arguments for flexibility:
- Environment selection (dev/staging/prod)
- Specific test cases
- Configuration overrides

## Error Handling

All scripts include:
- Exit code management (0 for success, non-zero for errors)
- Comprehensive error logging
- Rollback mechanisms for deployment scripts
- Graceful failure handling

## Logging

Scripts output to:
- Console for immediate feedback
- Log files in `logs/` directory
- System logs for deployment scripts
- Structured JSON logs for monitoring integration