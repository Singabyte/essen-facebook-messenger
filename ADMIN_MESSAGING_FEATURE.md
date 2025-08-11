# Admin Messaging & Bot Control Feature

## Overview

The ESSEN Facebook Messenger Bot admin interface now includes comprehensive messaging and bot control features, allowing administrators to:

1. **Turn off the bot for specific users** - Take over conversations manually
2. **Send messages directly to users** - Chat with users from the admin interface
3. **Real-time message synchronization** - See messages as they arrive
4. **Messenger-like interface** - Familiar chat UI similar to Facebook Messenger

## Features

### 1. Bot Control Toggle
- **Per-user bot control**: Enable/disable bot responses for individual users
- **Admin takeover mode**: When bot is disabled, admin can handle the conversation
- **Visual indicators**: Clear status showing bot enabled/disabled state
- **Instant effect**: Changes take effect immediately without restart

### 2. Direct Messaging
- **Send messages from admin panel**: Reply to users directly through the interface
- **Message history**: View complete conversation history with timestamps
- **Admin message tracking**: All admin messages are marked and tracked
- **Facebook API integration**: Messages sent through official Facebook Messenger API

### 3. Real-time Synchronization
- **WebSocket integration**: Live updates without page refresh
- **Bidirectional sync**: See user messages and admin responses in real-time
- **Multi-admin support**: Multiple admins can monitor the same conversation
- **Status updates**: Bot status changes reflected immediately

### 4. User Interface
- **Messenger-style chat**: Familiar chat interface with message bubbles
- **User avatars**: Profile pictures for visual identification
- **Message timestamps**: Clear time indicators for each message
- **Responsive design**: Works on desktop and mobile devices

## Installation & Setup

### 1. Apply Database Migration

Run the migration script to add required database fields:

```bash
node scripts/apply-bot-control-migration.js
```

Or manually apply the SQL:

```bash
psql $DATABASE_URL < sql/add-bot-control.sql
```

### 2. Update Environment Variables

Ensure these are set in both bot and admin server:

```env
# Bot server (.env)
PAGE_ACCESS_TOKEN=your_facebook_page_token
DATABASE_URL=postgresql://...

# Admin server (admin-interface/server/.env)
PAGE_ACCESS_TOKEN=your_facebook_page_token  # Same token
DATABASE_URL=postgresql://...  # Same database
JWT_SECRET=your_jwt_secret
```

### 3. Restart Services

```bash
# Restart the bot
pm2 restart facebook-bot

# Restart admin server
cd admin-interface/server && npm run dev

# Restart admin client
cd admin-interface/client && npm run dev
```

## Usage Guide

### Accessing the Messaging Interface

1. **Navigate to Users page** in the admin dashboard
2. **Click the chat icon** next to any user
3. The messaging drawer will open on the right side

### Controlling the Bot

1. **Toggle Bot Status**:
   - Use the switch in the user list or chat header
   - When OFF: Bot won't respond, admin takes over
   - When ON: Bot handles messages automatically

2. **Visual Indicators**:
   - Green switch = Bot enabled
   - Gray switch = Bot disabled (admin takeover)
   - Info banner shows current status in chat

### Sending Messages

1. **Type message** in the input field at the bottom
2. **Press Enter** or click send button
3. Message appears immediately in the chat
4. User receives it via Facebook Messenger

### Real-time Features

- **Live message updates**: New messages appear automatically
- **Typing indicators**: Shows when someone is typing
- **Online status**: See when users are active
- **Multi-tab sync**: Updates across all open admin tabs

## Technical Architecture

### Database Schema Changes

```sql
-- Users table additions
bot_enabled BOOLEAN DEFAULT true
admin_takeover BOOLEAN DEFAULT false
admin_takeover_at TIMESTAMP
admin_takeover_by VARCHAR(255)

-- Conversations table additions
is_admin_message BOOLEAN DEFAULT false
admin_id VARCHAR(255)
```

### API Endpoints

```javascript
// Toggle bot status
PUT /api/users/:id/bot-status
Body: { enabled: boolean }

// Send message to user
POST /api/users/:id/send-message
Body: { message: string }

// Get real-time conversation
GET /api/users/:id/real-time-conversation
Query: { limit: number }
```

### WebSocket Events

```javascript
// Client → Server
'join-user-room' - Join a user's chat room
'leave-user-room' - Leave a user's chat room
'send-message-to-user' - Send message to user

// Server → Client
'new-message' - New message received
'admin-message' - Admin sent a message
'bot-status-changed' - Bot status updated
'user-message-while-disabled' - User messaged while bot disabled
```

### Message Flow

1. **User sends message** → Facebook Webhook
2. **Bot checks status** → If disabled, skip processing
3. **Message saved** to database
4. **WebSocket broadcast** to admin interface
5. **Admin sends reply** → Facebook API
6. **Reply saved** to database
7. **WebSocket sync** to other admins

## Security Considerations

1. **Authentication Required**: All endpoints require JWT authentication
2. **Message Validation**: Input sanitization and validation
3. **Rate Limiting**: Prevents message flooding
4. **Audit Trail**: All admin actions are logged
5. **Facebook Signature**: Webhook requests verified

## Troubleshooting

### Bot not responding after disabling

**Issue**: Bot continues responding even after being disabled
**Solution**: 
- Check database connection
- Verify bot_enabled field is set to false
- Restart bot server if needed

### Messages not sending

**Issue**: Admin messages fail to send
**Solution**:
- Verify PAGE_ACCESS_TOKEN is correct
- Check Facebook API rate limits
- Ensure user hasn't blocked the page

### Real-time sync not working

**Issue**: Messages don't appear in real-time
**Solution**:
- Check WebSocket connection in browser console
- Verify Socket.io is running on admin server
- Check firewall/proxy settings

### Database migration fails

**Issue**: Migration script errors
**Solution**:
- Ensure DATABASE_URL is correct
- Check database user has ALTER TABLE permissions
- Run migration SQL manually if needed

## Best Practices

1. **Communication Guidelines**:
   - Inform users when admin takes over
   - Maintain professional tone
   - Document important conversations

2. **Bot Management**:
   - Only disable bot when necessary
   - Re-enable bot after resolving issues
   - Monitor disabled bot list regularly

3. **Performance**:
   - Limit real-time connections per admin
   - Archive old conversations
   - Use pagination for message history

4. **Security**:
   - Rotate JWT secrets regularly
   - Audit admin actions
   - Restrict admin access appropriately

## Future Enhancements

Planned improvements for the messaging system:

1. **Message Templates**: Pre-defined responses for common queries
2. **File Attachments**: Send images and documents
3. **Conversation Tags**: Categorize and filter conversations
4. **Team Assignment**: Assign conversations to specific admins
5. **Analytics**: Track response times and satisfaction
6. **Automation Rules**: Auto-disable bot for specific scenarios
7. **Mobile App**: Native mobile admin interface
8. **Voice Messages**: Support for audio messages

## Support

For issues or questions:
1. Check the logs: `pm2 logs facebook-bot`
2. Review admin server logs: `npm run dev`
3. Check database: Verify schema changes applied
4. Test Facebook API: Use `scripts/test-facebook-api.js`

## Credits

This feature was developed to provide ESSEN administrators with better control over customer interactions and enable personalized support when needed.