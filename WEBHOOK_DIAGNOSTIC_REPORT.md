# Facebook Webhook 504 Timeout Diagnostic Report

## Issue Summary
The Facebook bot webhook at `https://essen-messenger-bot-zxxtw.ondigitalocean.app` was experiencing 504 Gateway Timeout errors when receiving POST requests with Facebook message payloads.

## Root Cause Analysis

### Key Findings
1. **Basic endpoints work perfectly**: GET requests to `/health`, `/debug/version`, `/test` respond in 20-67ms
2. **Simple POST requests work**: Return expected 404 errors for non-webhook payloads
3. **Facebook webhooks fail immediately**: 504 errors occur in ~40ms (too fast for real timeout)
4. **Failure point identified**: Any payload with `"object": "page"` triggers the 504 error
5. **Database configuration issue**: Production app missing `DATABASE_URL` environment variable

### Technical Analysis
The 504 timeout occurs when the webhook handler processes Facebook payloads:

```javascript
if (body.object === 'page') {
  // Process each entry
  for (const entry of body.entry) {
    // FAILURE OCCURS HERE - in logAnalytics() database call
    await logAnalytics('webhook_received', senderId, {...});
  }
}
```

The issue is in the database layer:
- Production lacks `DATABASE_URL` environment variable
- App defaults to SQLite with path `/workspace/database/bot.db`
- DigitalOcean container cannot create/write to this SQLite database
- Database connection failure causes immediate 504 response from platform

## Test Results

### Comprehensive Test Suite Results
```
✅ healthCheck: PASSED (67ms)
❌ webhookVerification: FAILED (403 - expected)
❌ basicPost: FAILED (504 timeout)
✅ signedPost: SKIPPED (no APP_SECRET in test)
❌ databaseEndpoint: FAILED (504 timeout)
❌ stressTest: FAILED (0/5 requests successful)

Overall: 2/6 tests passed
```

### Isolation Test Results
Testing progressively complex payloads revealed:
- `{}` → 404 ✅
- `{"test": "data"}` → 404 ✅
- `{"object": "user"}` → 404 ✅
- `{"object": "page"}` → 504 ❌ **FAILURE POINT**
- All Facebook webhook payloads → 504 ❌

## Fix Implementation

### Changes Made
1. **Updated app.yaml**: Added `DATABASE_URL` environment variable as SECRET type
2. **Both services updated**: Main bot service and admin API service
3. **Database switching**: Will use PostgreSQL instead of SQLite when `DATABASE_URL` is set

```yaml
# Added to both facebook-bot and admin-api services
- key: DATABASE_URL
  type: SECRET
```

### Next Steps Required
1. **Create PostgreSQL database** in DigitalOcean (if not exists)
2. **Set DATABASE_URL secret** in DigitalOcean App Platform with connection string
3. **Deploy updated app.yaml** 
4. **Run migration script** to initialize PostgreSQL tables
5. **Re-test webhook functionality**

## PostgreSQL Setup Requirements

The `DATABASE_URL` should be set to a DigitalOcean Managed Database connection string:
```
postgresql://doadmin:PASSWORD@db-postgresql-REGION-NAME.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

The PostgreSQL database configuration in `src/database-pg.js` is already optimized for DigitalOcean with:
- SSL certificate handling for managed databases
- Connection pooling (max 15 connections in production)
- Proper timeout settings
- Application name for monitoring

## Verification Plan

After fix deployment:
1. Run `node test-production-webhook.js` to verify all tests pass
2. Test actual Facebook webhook integration
3. Monitor application logs for database connection success
4. Verify admin interface can connect to same database

## Files Modified
- `/app.yaml` - Added DATABASE_URL environment variable
- `/test-production-webhook.js` - Comprehensive test suite (created)
- `/diagnose-production-issue.js` - Diagnostic tool (created)
- `/test-webhook-minimal.js` - Payload isolation test (created)

## Architecture Notes
The bot correctly uses a database abstraction layer (`src/database.js`) that automatically switches between SQLite and PostgreSQL based on `DATABASE_URL` presence. The PostgreSQL implementation (`src/database-pg.js`) is production-ready with proper SSL handling for DigitalOcean managed databases.