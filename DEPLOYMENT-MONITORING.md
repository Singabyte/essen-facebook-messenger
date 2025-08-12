# Monitoring System Deployment Guide for DigitalOcean

## Overview
The monitoring system provides real-time metrics and message tracking for the ESSEN Facebook Messenger Bot.

## Architecture

### Services Communication
```
┌─────────────────┐     Socket.io      ┌──────────────┐     Socket.io     ┌──────────────┐
│  Facebook Bot   │ ──────────────────> │  Admin API   │ <───────────────  │  Admin UI    │
│  (Port 3000)    │                     │  (Port 4000) │                    │  (Static)    │
└─────────────────┘                     └──────────────┘                    └──────────────┘
        ↓                                        ↓                                  ↓
   Sends metrics                          Broadcasts to                      Displays in
   & messages                             admin clients                      dashboard
```

## Production Configuration

### 1. Facebook Bot Service (`facebook-bot`)

**Socket.io Client Configuration:**
- Connects to: `https://essen-messenger-bot-zxxtw.ondigitalocean.app`
- Socket path: `/api/socket.io/`
- Transport: Polling first, then WebSocket
- Authentication: `{ service: 'bot', secret: 'bot-service' }`

**Environment Variables:**
```yaml
ADMIN_BACKEND_URL: https://essen-messenger-bot-zxxtw.ondigitalocean.app
NODE_ENV: production
```

**Key Files:**
- `/src/admin-socket-client.js` - Socket.io client implementation
- `/src/monitoring.js` - MetricsCollector class
- `/src/messageHandler.js` - Message processing with metrics

### 2. Admin API Service (`admin-api`)

**Socket.io Server Configuration:**
- Path: `/socket.io/` (DigitalOcean strips `/api` prefix)
- CORS: Allows production domains and bot service
- Namespaces: Main namespace with auth middleware

**WebSocket Events:**
- `metrics:update` - Receives metrics from bot
- `message:processed` - Receives message events
- `health:changed` - Service health updates

**Broadcasting Rooms:**
- `admins` - All admin users
- `monitoring` - Monitoring page subscribers
- `user-{id}` - User-specific conversations

### 3. Admin UI (`admin-ui`)

**Socket.io Client Configuration:**
- Connects to: `https://essen-messenger-bot-zxxtw.ondigitalocean.app/api`
- Socket path: `/api/socket.io/`
- Authentication: JWT token from login

**Monitoring Page Features:**
- Real-time metrics cards
- Service health indicators
- Activity trend chart
- Live message feed

## Deployment Steps

### 1. Pre-deployment Checklist
- [x] Socket.io client configured for production URLs
- [x] CORS configured for production domains
- [x] Environment variables added to app.yaml
- [x] Monitoring endpoints implemented
- [x] WebSocket events tested

### 2. Deploy to DigitalOcean
```bash
# Commit changes
git add .
git commit -m "Add monitoring system with Socket.io real-time updates"
git push origin main

# DigitalOcean will auto-deploy via GitHub integration
```

### 3. Post-deployment Verification

#### Test Bot Connection
```bash
# SSH into bot container or check logs
# Look for: "✅ Connected to admin backend via Socket.io"
```

#### Test Metrics Flow
1. Send test message to Facebook bot
2. Check admin API logs for: "📊 Received metrics:update from bot"
3. Open admin UI monitoring page
4. Verify real-time updates appear

#### Test with Script
```bash
# Run from local machine
node scripts/test-production-socket.js
# Should connect to production and send test metrics
```

## Monitoring Endpoints

### Bot Service
- `GET /debug/health-quick` - Quick health check
- `GET /debug/metrics` - Current metrics snapshot
- `GET /debug/system-stats` - System resource usage
- `GET /debug/message-stream` - SSE message stream

### Admin API
- `GET /api/monitoring/metrics` - Aggregated metrics
- `GET /api/monitoring/health-comprehensive` - Detailed health
- `WebSocket /api/socket.io/` - Real-time updates

## Troubleshooting

### Socket.io Connection Issues

#### Bot Can't Connect to Admin
1. Check `ADMIN_BACKEND_URL` environment variable
2. Verify admin-api service is running
3. Check CORS configuration in websocket.js
4. Review bot logs for connection errors

#### No Real-time Updates in UI
1. Check browser console for WebSocket errors
2. Verify JWT token is valid
3. Check network tab for Socket.io polling/websocket
4. Ensure monitoring room subscription

### Common Issues

**Issue**: "CORS error" in browser console
**Solution**: Add domain to CORS whitelist in websocket.js

**Issue**: Bot shows "Connection timeout"
**Solution**: Check if admin-api service is deployed and healthy

**Issue**: Metrics not updating
**Solution**: Verify MetricsCollector is recording messages in messageHandler.js

## Performance Considerations

### Socket.io Optimization
- Uses polling first for reliability
- Falls back to WebSocket for lower latency
- Reconnection with exponential backoff
- Message batching for efficiency

### Metrics Collection
- In-memory circular buffers
- Hourly aggregation
- Automatic cleanup of old data
- No database writes for real-time data

## Security

### Authentication
- Bot uses service authentication with secret
- Admin users require JWT tokens
- No public access to monitoring endpoints

### Data Protection
- No PII in metrics
- Aggregated statistics only
- Message content sanitized
- SSL/TLS for all connections

## Monitoring the Monitoring System

### Health Indicators
- Socket.io connection status in logs
- Memory usage in system stats
- Message processing latency
- Active connection count

### Log Patterns
```
✅ Connected to admin backend - Successful connection
📊 Received metrics:update - Metrics flowing
💬 Received message:processed - Messages tracked
❌ Disconnected from admin - Connection lost
⚠️ Connection error - Retry in progress
```

## Future Enhancements

1. **Persistent Metrics**: Store time-series data in PostgreSQL
2. **Alerting**: Threshold-based alerts for anomalies
3. **Advanced Analytics**: Conversion funnels, user journeys
4. **Export Features**: CSV/PDF reports
5. **Mobile App**: React Native monitoring app