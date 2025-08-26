# Instagram Integration Setup Guide

## Overview
The ESSEN bot now supports both Facebook Messenger and Instagram Direct Messages through the same webhook and infrastructure.

## What's Been Added

### 1. Core Changes
- **Webhook Handler** (`src/webhook.js`): Now handles both `object === 'page'` (Facebook) and `object === 'instagram'` (Instagram) events
- **Platform Adapter** (`src/platform-adapter.js`): Abstracts platform differences for sending messages and fetching profiles
- **Message Handler** (`src/messageHandler.js`): Platform-aware message processing
- **Database Schema**: Added `platform` column to track message source

### 2. Admin Interface Updates
- Users page shows platform badges (Facebook/Instagram icons)
- Conversations display platform source
- Platform filtering capabilities

### 3. Testing & Migration
- **Test Script** (`scripts/test-instagram.js`): Comprehensive testing for Instagram integration
- **Migration Script** (`scripts/migrate-instagram.js`): Updates existing database for platform support

## Setup Instructions

### 1. Run Database Migration
```bash
# Add platform columns to existing database
node scripts/migrate-instagram.js
```

### 2. Configure Instagram Webhook

1. Go to [Meta Business Suite](https://business.facebook.com)
2. Navigate to your App Settings
3. Under "Webhooks", add your webhook URL if not already configured
4. Subscribe to Instagram webhooks:
   - `messages` - For receiving Instagram DMs
   - `messaging_postbacks` - For button/quick reply interactions
   - `messaging_referrals` - For tracking referrals

### 3. Add Instagram Permissions

In your Facebook App settings:
1. Go to "App Review" → "Permissions and Features"
2. Request these permissions:
   - `instagram_basic` - Basic Instagram access
   - `instagram_manage_messages` - Send and receive messages
   - `pages_manage_metadata` - Manage page metadata

### 4. Connect Instagram Account

1. In Meta Business Suite, go to "Settings" → "Instagram Accounts"
2. Connect your Instagram Professional account
3. Grant messaging permissions to your app
4. The Instagram access token should be generated automatically

### 5. Test the Integration

```bash
# Start the server
npm run dev

# In another terminal, run tests
node scripts/test-instagram.js
```

## Environment Variables

Your `.env` file already contains Instagram credentials:
```env
INSTAGRAM_SECRET=2caf536c12e8357a16148ac700d63573
INSTAGRAM_ID=2323116818118876
INSTAGRAM_ACCESS_TOKEN=IGAAhA3Mi3ONxBZAE82ZAW...
```

## How It Works

### Message Flow
1. **Instagram user sends DM** → Meta sends webhook to `/webhook`
2. **Webhook identifies platform** → Routes to appropriate handler
3. **Message processed with AI** → Same Gemini integration as Facebook
4. **Response sent back** → Platform adapter handles Instagram API
5. **Stored in database** → Tagged with platform for tracking

### Platform Detection
- Facebook messages: `body.object === 'page'`
- Instagram messages: `body.object === 'instagram'`
- Platform stored with each conversation for analytics

### Unified Experience
- Same AI responses (Gemini with ESSEN knowledge base)
- Same admin interface for management
- Same database for conversation history
- Platform-specific features when needed

## Testing Different Scenarios

The test script covers:
- ✅ Instagram standard messaging format
- ✅ Instagram DM alternative format
- ✅ Image attachments from Instagram
- ✅ Platform differentiation in database
- ✅ Webhook signature verification

Run specific tests:
```bash
# Test only Instagram messages
node scripts/test-instagram.js

# Test with production webhook
NODE_ENV=production node scripts/test-instagram.js
```

## Monitoring

Check platform distribution in admin interface:
1. Go to Dashboard → See platform breakdown
2. Users page → Filter by platform
3. Conversations → View platform badges

## Troubleshooting

### Instagram messages not coming through?
1. Check webhook subscription in Meta Business Suite
2. Verify Instagram permissions are approved
3. Check server logs for webhook events
4. Run test script to simulate messages

### Platform not showing in admin?
1. Run database migration: `node scripts/migrate-instagram.js`
2. Restart admin interface: `cd admin-interface/server && npm run dev`
3. Clear browser cache and refresh

### Different response times between platforms?
- Instagram may have different rate limits
- Check `platform-adapter.js` for platform-specific configurations
- Monitor API response times in logs

## Next Steps

1. **Test with real Instagram account** - Send actual DMs to verify
2. **Monitor both platforms** - Watch admin dashboard for issues
3. **Customize responses** - Add platform-specific greetings if needed
4. **Set up analytics** - Track conversion rates by platform

## Support

For issues or questions:
- Check server logs: `pm2 logs facebook-bot`
- Run diagnostics: `node scripts/verify-integration.js`
- Test webhook: `node scripts/test-instagram.js`

The integration is designed to be seamless - your existing chatbot logic, AI responses, and admin tools all work automatically with Instagram messages!