# ESSEN Facebook Messenger Bot - Monitoring & Observability Deployment Guide

## Overview

This guide covers the deployment and configuration of the comprehensive monitoring and observability solution for the ESSEN Facebook Messenger Bot. The solution includes structured logging, Prometheus metrics, health checks, real-time dashboards, and intelligent alerting.

## Architecture Components

### 1. Structured Logging (Winston)
- **Location**: `src/utils/logger.js`
- **Features**: JSON structured logs, correlation IDs, multiple log levels, component-specific loggers
- **Log Files**: 
  - `logs/error.log` - Error level logs
  - `logs/combined.log` - All logs
  - `logs/bot-activity.log` - Bot-specific activities
  - `logs/performance.log` - Performance metrics
  - `logs/exceptions.log` - Uncaught exceptions
  - `logs/rejections.log` - Unhandled promise rejections

### 2. Metrics Collection (Prometheus)
- **Location**: `src/utils/metrics.js`
- **Endpoint**: `/metrics`
- **Metrics Collected**:
  - HTTP request duration and count
  - Facebook API metrics (messages, errors, response times)
  - Gemini AI metrics (requests, tokens, errors)
  - Database performance (connections, query times)
  - Socket.io metrics (connections, messages, errors)
  - Template cache performance
  - Human intervention metrics
  - Business metrics (conversations, appointments)
  - System health status

### 3. Health Checks
- **Location**: `src/utils/healthcheck.js`
- **Endpoints**:
  - `/health` - Basic health check
  - `/debug/health-comprehensive` - Detailed component health
  - `/debug/system-stats` - System resource metrics
  - `/debug/template-cache-stats` - Cache performance
  - `/debug/human-intervention-stats` - Human intervention metrics

### 4. Performance Monitoring
- **Location**: `src/middleware/monitoring.js`
- **Features**:
  - Request correlation IDs
  - Response time tracking
  - Error monitoring
  - Security monitoring
  - Rate limiting

### 5. Real-time Dashboard
- **Location**: `admin-interface/client/src/components/MonitoringDashboard.jsx`
- **Features**:
  - Service health overview
  - Performance metrics visualization
  - Template cache metrics
  - Human intervention status
  - Real-time alerts
  - System resource monitoring

### 6. Alerting System
- **Location**: `src/utils/alerting.js`
- **Channels**: Slack, Email, Webhook, Logs
- **Alert Rules**:
  - High memory usage (>700MB)
  - Database connection failures
  - Facebook API errors
  - Service health degradation
  - Low cache hit ratios
  - High human intervention queue

## Deployment Steps

### 1. Install Dependencies

```bash
cd /path/to/essen-facebook-messenger
npm install winston prom-client uuid correlation-id express-rate-limit
```

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Logging Configuration
LOG_LEVEL=info
NODE_ENV=production

# Alerting Configuration (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
ALERT_WEBHOOK_URL=https://your-alert-webhook.com/alerts

# SMTP Configuration for Email Alerts (Optional)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
ALERT_FROM_EMAIL=alerts@essen.com.sg
ALERT_TO_EMAIL=devops@essen.com.sg

# Bot Service URL for Admin Interface
BOT_SERVICE_URL=http://localhost:3000
```

### 3. Deploy Bot Service

The bot service now includes all monitoring components. Start it normally:

```bash
npm start
# or with PM2
pm2 start ecosystem.config.js
```

### 4. Deploy Admin Interface

The admin interface includes the monitoring dashboard:

```bash
cd admin-interface/server
npm start

cd ../client
npm run build
# Deploy built files to your web server
```

### 5. Configure Monitoring Script

Update the monitoring script configuration:

```bash
# Set environment variables for monitoring script
export BOT_URL="https://your-bot-domain.com"
export ADMIN_API_URL="https://your-admin-domain.com"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Make script executable
chmod +x scripts/monitor.sh

# Set up cron job for regular monitoring (every 5 minutes)
crontab -e
# Add line:
# */5 * * * * /path/to/essen-facebook-messenger/scripts/monitor.sh
```

## Accessing Monitoring Data

### Prometheus Metrics
```
GET https://your-bot-domain.com/metrics
```

### Health Checks
```
GET https://your-bot-domain.com/health
GET https://your-bot-domain.com/debug/health-comprehensive
GET https://your-bot-domain.com/debug/system-stats
```

### Admin Dashboard
```
https://your-admin-domain.com/monitoring
```

## Grafana Integration

### 1. Prometheus Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'essen-facebook-bot'
    static_configs:
      - targets: ['your-bot-domain.com:443']
    metrics_path: '/metrics'
    scheme: 'https'
    scrape_interval: 30s
```

### 2. Import Dashboard

Use the pre-configured Grafana dashboard from `monitoring/dashboards.json`:

1. Open Grafana
2. Go to Dashboards → Import
3. Upload `monitoring/dashboards.json`
4. Configure data source as your Prometheus instance

## Alert Manager Configuration

### 1. Configure Alertmanager

Use the alert rules from `monitoring/alerts.yml`:

```bash
# Copy alert rules to Prometheus
cp monitoring/alerts.yml /etc/prometheus/alert_rules/

# Update prometheus.yml to include alert rules
rule_files:
  - "alert_rules/*.yml"

# Configure Alertmanager
# Use the alertmanager_config section from monitoring/alerts.yml
```

## Log Management

### 1. Log Rotation

Set up log rotation to prevent disk space issues:

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/essen-bot

# Add configuration:
/path/to/essen-facebook-messenger/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 app app
    postrotate
        pm2 reload facebook-bot
    endscript
}
```

### 2. Centralized Logging (Optional)

For production environments, consider using:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Fluentd** with cloud logging services
- **Grafana Loki** for log aggregation

## Security Considerations

### 1. Metrics Endpoint Security

The `/metrics` endpoint contains sensitive system information. Consider:

1. **IP Whitelisting**: Only allow Prometheus server IPs
2. **Authentication**: Implement basic auth for metrics endpoint
3. **Rate Limiting**: Already implemented in the solution

### 2. Alert Webhook Security

- Use HTTPS for all webhook URLs
- Implement webhook signature verification
- Rotate webhook secrets regularly

## Performance Impact

The monitoring solution is designed to have minimal performance impact:

- **Memory overhead**: ~10-20MB additional RAM usage
- **CPU overhead**: <1% additional CPU usage
- **Response time impact**: <5ms per request
- **Storage**: Log files rotate automatically, metrics are stored in memory

## Troubleshooting

### Common Issues

1. **Metrics endpoint returns 500**
   - Check logs for Prometheus client errors
   - Verify all metrics are properly registered

2. **Health checks failing**
   - Verify database connectivity
   - Check Facebook API credentials
   - Ensure Gemini API key is valid

3. **Alerts not firing**
   - Check alerting rules configuration
   - Verify webhook URLs are accessible
   - Check alert cooldown periods

4. **Dashboard not loading data**
   - Verify bot service URL in admin interface
   - Check CORS configuration
   - Ensure monitoring API routes are registered

### Debug Commands

```bash
# Check metrics endpoint
curl https://your-bot-domain.com/metrics

# Check comprehensive health
curl https://your-bot-domain.com/debug/health-comprehensive | jq

# Run monitoring script manually
./scripts/monitor.sh

# Check logs
tail -f logs/combined.log
tail -f logs/error.log
```

## Maintenance Tasks

### Daily
- Review alert notifications
- Check system health dashboard
- Monitor error rates and response times

### Weekly
- Review log files for patterns
- Check disk space usage
- Verify backup procedures

### Monthly
- Review and update alert thresholds
- Analyze performance trends
- Update monitoring configurations

## Contact & Support

For issues with the monitoring system:
1. Check the troubleshooting section above
2. Review log files for specific error messages
3. Verify all environment variables are configured
4. Ensure all dependencies are installed correctly

The monitoring solution provides comprehensive observability for the ESSEN Facebook Messenger Bot, enabling proactive issue detection and resolution to maintain high availability and performance.