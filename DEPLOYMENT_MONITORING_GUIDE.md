# ESSEN Facebook Messenger Bot - Complete Deployment & Monitoring Guide

## Overview
This guide covers the complete deployment process for the ESSEN Facebook Messenger Bot with enhanced monitoring, analytics, and observability features on DigitalOcean App Platform.

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Deployment Process](#deployment-process)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring Setup](#monitoring-setup)
7. [Analytics Configuration](#analytics-configuration)
8. [Alerting Configuration](#alerting-configuration)
9. [Maintenance Procedures](#maintenance-procedures)
10. [Troubleshooting](#troubleshooting)

## Pre-Deployment Checklist

### Required Accounts and Access
- [ ] DigitalOcean account with App Platform access
- [ ] Facebook Developer account with app created
- [ ] Google Cloud account with Gemini API access
- [ ] Slack workspace (for alerting)
- [ ] Domain configuration (if using custom domain)

### Required Environment Variables
```bash
# Facebook Integration
PAGE_ACCESS_TOKEN=your_facebook_page_access_token
VERIFY_TOKEN=your_webhook_verify_token
APP_SECRET=your_facebook_app_secret

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Admin Authentication
JWT_SECRET=your_jwt_secret_key

# Monitoring & Alerting (Optional)
SLACK_WEBHOOK_URL=your_slack_webhook_url
ALERT_EMAIL=your_alert_email@example.com
```

## Environment Configuration

### 1. Update app.yaml with Monitoring Features
```yaml
# Add these environment variables to facebook-bot service
- key: ENABLE_PROMETHEUS_METRICS
  value: "true"
- key: METRICS_PORT
  value: "9090"
- key: ENABLE_STRUCTURED_LOGGING
  value: "true"
- key: LOG_LEVEL
  value: "info"
- key: ALERT_COOLDOWN_MINUTES
  value: "30"
- key: SLACK_WEBHOOK_URL
  type: SECRET

# Add these to admin-api service
- key: ENABLE_ANALYTICS_TRACKING
  value: "true"
- key: DATA_RETENTION_DAYS
  value: "180"
- key: ANALYTICS_SUMMARY_INTERVAL
  value: "daily"
```

### 2. Configure Resource Limits
```yaml
# Update instance sizes for production load
services:
- name: facebook-bot
  instance_size_slug: basic-s  # Upgrade from basic-xs
  autoscaling:
    min_instance_count: 2     # Minimum 2 instances for HA
    max_instance_count: 5     # Scale up to 5 during peak

- name: admin-api
  instance_size_slug: basic-s  # Upgrade from basic-xs
```

## Database Setup

### 1. Initialize Database Schema
```bash
# SSH into your deployment or run locally with production DATABASE_URL
export DATABASE_URL="your_production_database_url"

# Run database initialization
node scripts/init-database.js

# Create admin user
node admin-interface/server/create-admin-pg.js
```

### 2. Create Analytics Tables and Views
```sql
-- Connect to your production database
-- Run the analytics schema creation
\i sql/analytics-schema.sql

-- Create performance indexes
\i sql/performance-indexes.sql

-- Initialize monitoring views
\i sql/monitoring-views.sql
```

### 3. Enable Database Extensions
```sql
-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Deployment Process

### 1. Pre-Deployment Tests
```bash
# Run all tests locally
npm run test:unit
npm run test:integration

# Build admin interface
cd admin-interface/client && npm run build
```

### 2. Deploy to DigitalOcean
```bash
# Option 1: Deploy via GitHub integration (recommended)
git add .
git commit -m "Deploy: Enhanced monitoring and analytics features"
git push origin main

# Option 2: Deploy via DigitalOcean CLI
doctl apps create --spec app.yaml
doctl apps update <app-id> --spec app.yaml
```

### 3. Monitor Deployment Progress
```bash
# Watch deployment logs
doctl apps logs <app-id> --follow

# Check deployment status
doctl apps list
```

## Post-Deployment Verification

### 1. Health Check Verification
```bash
# Check bot health
curl https://your-app-url.ondigitalocean.app/health

# Check comprehensive health
curl https://your-app-url.ondigitalocean.app/debug/health-comprehensive

# Check admin API health
curl https://your-app-url.ondigitalocean.app/api/health
```

### 2. Monitoring Endpoints Verification
```bash
# Verify Prometheus metrics
curl https://your-app-url.ondigitalocean.app/metrics

# Check template cache stats
curl https://your-app-url.ondigitalocean.app/debug/template-cache-stats

# Check system stats
curl https://your-app-url.ondigitalocean.app/debug/system-stats

# Check database stats
curl https://your-app-url.ondigitalocean.app/debug/database-stats
```

### 3. Facebook Webhook Verification
```bash
# Test webhook endpoint
curl -X GET "https://your-app-url.ondigitalocean.app/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test"

# Send test message
curl -X POST https://your-app-url.ondigitalocean.app/debug/test-message \
  -H "Content-Type: application/json" \
  -d '{"recipientId":"YOUR_TEST_USER_ID","message":"Deployment test successful!"}'
```

## Monitoring Setup

### 1. Access Monitoring Dashboard
1. Navigate to https://your-app-url.ondigitalocean.app/admin
2. Login with admin credentials
3. Go to Monitoring section
4. Verify all service indicators are green

### 2. Configure External Monitoring (Optional)
```bash
# Set up UptimeRobot or similar
- Monitor URL: https://your-app-url.ondigitalocean.app/health
- Check interval: 5 minutes
- Alert contacts: Your team

# Configure Prometheus scraping
- Target: https://your-app-url.ondigitalocean.app/metrics
- Scrape interval: 30s
```

### 3. Set Up Log Aggregation
```bash
# Configure DigitalOcean log forwarding to Logtail/Datadog
doctl apps update <app-id> --spec app.yaml \
  --log-destination papertrail://logs.papertrailapp.com:12345
```

## Analytics Configuration

### 1. Enable Analytics Features
1. Access admin dashboard at /admin/analytics
2. Configure data retention settings
3. Set up automated report schedules
4. Enable real-time analytics updates

### 2. Business Metrics Tracking
```javascript
// Verify business metrics are being tracked
GET /api/analytics/business-metrics

// Expected metrics:
{
  "totalUsers": 1250,
  "totalConversations": 3500,
  "totalAppointments": 85,
  "conversionRate": 0.024,
  "avgResponseTime": 1.2,
  "satisfactionScore": 4.5
}
```

### 3. Configure Automated Reports
```bash
# Set up daily business reports
curl -X POST https://your-app-url.ondigitalocean.app/api/analytics/schedule-report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "frequency": "daily",
    "time": "09:00",
    "recipients": ["team@essen.com.sg"],
    "includeMetrics": ["engagement", "conversions", "satisfaction"]
  }'
```

## Alerting Configuration

### 1. Slack Integration
```bash
# Test Slack webhook
curl -X POST $SLACK_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text":"🚀 ESSEN Bot monitoring is active!"}'
```

### 2. Configure Alert Rules
```javascript
// Update alert thresholds in environment variables
ALERT_HIGH_MEMORY_MB=700
ALERT_HIGH_CPU_PERCENT=80
ALERT_HIGH_ERROR_RATE=0.1
ALERT_LOW_CACHE_HIT_RATIO=0.8
ALERT_MAX_PENDING_INTERVENTIONS=5
```

### 3. Test Alert System
```bash
# Trigger test alert
curl -X POST https://your-app-url.ondigitalocean.app/api/monitoring/test-alert \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Maintenance Procedures

### 1. Regular Health Checks
```bash
# Run monitoring script
./scripts/monitor.sh

# Check system performance
./scripts/check-performance.sh
```

### 2. Database Maintenance
```bash
# Weekly maintenance tasks
./scripts/db-maintenance.sh

# Archive old data
node scripts/archive-old-data.js --days=180

# Optimize database
psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

### 3. Log Rotation
```bash
# Configure log rotation
cat > /etc/logrotate.d/essen-bot << EOF
/var/log/essen-bot/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOF
```

### 4. Backup Procedures
```bash
# Automated daily backups
./scripts/backup.sh

# Manual backup before major updates
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Socket.io Connection Issues
```bash
# Check Socket.io status
curl https://your-app-url.ondigitalocean.app/api/debug/socket-status

# Verify CORS settings
# Ensure SOCKET_IO_CORS_ORIGIN matches your app URL
```

#### 2. High Memory Usage
```bash
# Check memory usage
curl https://your-app-url.ondigitalocean.app/debug/system-stats

# If memory > 700MB, check for:
# - Memory leaks in conversation history
# - Large template cache
# - Unclosed database connections
```

#### 3. Slow Response Times
```bash
# Check database performance
curl https://your-app-url.ondigitalocean.app/debug/database-stats

# Analyze slow queries
psql $DATABASE_URL -c "SELECT * FROM v_slow_queries;"
```

#### 4. Facebook Webhook Failures
```bash
# Verify webhook signature
# Check APP_SECRET is correctly set
# Ensure webhook URL is registered in Facebook App
```

#### 5. Analytics Data Missing
```bash
# Check analytics tracking
curl https://your-app-url.ondigitalocean.app/api/analytics/health

# Verify database tables exist
psql $DATABASE_URL -c "\dt analytics.*"
```

### Debug Commands
```bash
# Enable debug logging temporarily
doctl apps update <app-id> --env LOG_LEVEL=debug

# View recent errors
doctl apps logs <app-id> --type=error --lines=100

# Check deployment status
doctl apps get <app-id>
```

### Performance Optimization
1. **Enable caching**: Ensure template cache is active
2. **Optimize queries**: Use database views for complex queries
3. **Scale horizontally**: Increase instance count during peak hours
4. **Monitor metrics**: Watch /metrics endpoint for bottlenecks

## Security Considerations

### 1. Secure Environment Variables
- Use DigitalOcean's secret management for sensitive values
- Rotate JWT tokens regularly
- Keep Facebook tokens updated

### 2. Access Control
- Limit admin dashboard access by IP (if needed)
- Use strong passwords for admin accounts
- Enable 2FA for DigitalOcean account

### 3. Data Protection
- Enable SSL/TLS (automatic with App Platform)
- Encrypt sensitive data in database
- Regular security audits

## Support and Resources

### Documentation
- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [Facebook Messenger Platform](https://developers.facebook.com/docs/messenger-platform)
- [Monitoring Best Practices](https://docs.digitalocean.com/products/monitoring/)

### Monitoring URLs
- Health Check: `/health`
- Metrics: `/metrics`
- Admin Dashboard: `/admin`
- Analytics: `/admin/analytics`
- Monitoring: `/admin/monitoring`

### Emergency Contacts
- DevOps Team: devops@essen.com.sg
- On-call Engineer: Use PagerDuty integration
- Slack Channel: #essen-bot-alerts

## Conclusion
This deployment includes comprehensive monitoring, analytics, and alerting capabilities. The system is designed for high availability with automatic scaling and health checks. Regular monitoring and maintenance will ensure optimal performance for ESSEN's customers.

For additional support or custom configurations, refer to the technical documentation or contact the development team.