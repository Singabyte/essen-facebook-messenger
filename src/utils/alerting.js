const { loggers } = require('./logger');
const { metricsCollector } = require('./metrics');

/**
 * Alerting system for ESSEN Facebook Messenger Bot
 * Supports multiple alert channels and severity levels
 */

// Alert severity levels
const AlertSeverity = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

// Alert channels
const AlertChannels = {
  SLACK: 'slack',
  EMAIL: 'email',
  WEBHOOK: 'webhook',
  LOG: 'log'
};

// Alert rules configuration
const alertRules = [
  {
    name: 'HighMemoryUsage',
    condition: (metrics) => metrics.memoryUsageMB > 700,
    severity: AlertSeverity.CRITICAL,
    channels: [AlertChannels.SLACK, AlertChannels.EMAIL],
    cooldown: 600000, // 10 minutes
    message: (metrics) => `High memory usage detected: ${metrics.memoryUsageMB}MB (threshold: 700MB)`
  },
  {
    name: 'DatabaseConnectionFailure',
    condition: (health) => !health.services?.database?.healthy,
    severity: AlertSeverity.CRITICAL,
    channels: [AlertChannels.SLACK, AlertChannels.EMAIL],
    cooldown: 300000, // 5 minutes
    message: (health) => `Database connection failure: ${health.services?.database?.error || 'Unknown error'}`
  },
  {
    name: 'FacebookApiError',
    condition: (health) => !health.services?.facebook?.healthy,
    severity: AlertSeverity.CRITICAL,
    channels: [AlertChannels.SLACK, AlertChannels.EMAIL],
    cooldown: 300000, // 5 minutes
    message: (health) => `Facebook API error: ${health.services?.facebook?.error || 'Unknown error'}`
  },
  {
    name: 'GeminiApiError',
    condition: (health) => !health.services?.gemini?.healthy,
    severity: AlertSeverity.WARNING,
    channels: [AlertChannels.SLACK],
    cooldown: 600000, // 10 minutes
    message: (health) => `Gemini AI API error: ${health.services?.gemini?.error || 'Unknown error'}`
  },
  {
    name: 'SocketIoDisconnected',
    condition: (health) => !health.services?.socketio?.healthy,
    severity: AlertSeverity.WARNING,
    channels: [AlertChannels.SLACK],
    cooldown: 300000, // 5 minutes
    message: (health) => `Socket.io connection lost: ${health.services?.socketio?.error || 'Disconnected'}`
  },
  {
    name: 'LowTemplateCacheHitRatio',
    condition: (cache) => cache.hitRatio < 0.8,
    severity: AlertSeverity.WARNING,
    channels: [AlertChannels.LOG],
    cooldown: 1800000, // 30 minutes
    message: (cache) => `Low template cache hit ratio: ${Math.round(cache.hitRatio * 100)}% (threshold: 80%)`
  },
  {
    name: 'HighHumanInterventionQueue',
    condition: (intervention) => intervention.pendingCount > 5,
    severity: AlertSeverity.WARNING,
    channels: [AlertChannels.SLACK],
    cooldown: 900000, // 15 minutes
    message: (intervention) => `High number of pending human interventions: ${intervention.pendingCount} (threshold: 5)`
  },
  {
    name: 'ServiceHealthDegraded',
    condition: (health) => health.overall === 'degraded',
    severity: AlertSeverity.WARNING,
    channels: [AlertChannels.SLACK],
    cooldown: 600000, // 10 minutes
    message: (health) => `System health degraded. Check individual services for details.`
  },
  {
    name: 'ServiceHealthUnhealthy',
    condition: (health) => health.overall === 'unhealthy',
    severity: AlertSeverity.CRITICAL,
    channels: [AlertChannels.SLACK, AlertChannels.EMAIL],
    cooldown: 300000, // 5 minutes
    message: (health) => `System health critical. Multiple services are failing.`
  },
  {
    name: 'HighErrorRate',
    condition: (metrics) => metrics.errorRate > 0.1, // 10% error rate
    severity: AlertSeverity.WARNING,
    channels: [AlertChannels.SLACK],
    cooldown: 600000, // 10 minutes
    message: (metrics) => `High error rate detected: ${Math.round(metrics.errorRate * 100)}% (threshold: 10%)`
  }
];

// Track alert cooldowns to prevent spam
const alertCooldowns = new Map();

/**
 * Alert manager class
 */
class AlertManager {
  constructor() {
    this.channels = new Map();
    this.setupChannels();
  }

  /**
   * Setup alert channels
   */
  setupChannels() {
    // Slack channel
    if (process.env.SLACK_WEBHOOK_URL) {
      this.channels.set(AlertChannels.SLACK, {
        send: this.sendSlackAlert.bind(this),
        enabled: true
      });
    }

    // Email channel (would require email service setup)
    if (process.env.SMTP_HOST) {
      this.channels.set(AlertChannels.EMAIL, {
        send: this.sendEmailAlert.bind(this),
        enabled: true
      });
    }

    // Webhook channel
    if (process.env.ALERT_WEBHOOK_URL) {
      this.channels.set(AlertChannels.WEBHOOK, {
        send: this.sendWebhookAlert.bind(this),
        enabled: true
      });
    }

    // Log channel (always available)
    this.channels.set(AlertChannels.LOG, {
      send: this.sendLogAlert.bind(this),
      enabled: true
    });
  }

  /**
   * Check all alert rules against current system state
   */
  checkAlerts(systemHealth, systemMetrics, cacheStats, interventionStats) {
    const now = Date.now();

    alertRules.forEach(rule => {
      try {
        let shouldAlert = false;
        let data = null;

        // Determine which data to pass to the rule condition
        switch (rule.name) {
          case 'HighMemoryUsage':
          case 'HighErrorRate':
            data = systemMetrics;
            break;
          case 'LowTemplateCacheHitRatio':
            data = cacheStats;
            break;
          case 'HighHumanInterventionQueue':
            data = interventionStats;
            break;
          default:
            data = systemHealth;
        }

        // Check if condition is met
        if (data && rule.condition(data)) {
          shouldAlert = true;
        }

        // Check cooldown
        const lastAlert = alertCooldowns.get(rule.name);
        if (lastAlert && (now - lastAlert) < rule.cooldown) {
          shouldAlert = false;
        }

        if (shouldAlert) {
          this.triggerAlert(rule, data);
          alertCooldowns.set(rule.name, now);
        }

      } catch (error) {
        loggers.monitoring.error('Error checking alert rule', {
          rule: rule.name,
          error: error.message
        });
      }
    });
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(rule, data) {
    const alert = {
      name: rule.name,
      severity: rule.severity,
      message: rule.message(data),
      timestamp: new Date().toISOString(),
      data
    };

    loggers.monitoring.warn('Alert triggered', alert);

    // Send to all configured channels
    const sendPromises = rule.channels.map(channelName => {
      const channel = this.channels.get(channelName);
      if (channel && channel.enabled) {
        return channel.send(alert).catch(error => {
          loggers.monitoring.error('Failed to send alert', {
            channel: channelName,
            alert: rule.name,
            error: error.message
          });
        });
      }
    });

    await Promise.allSettled(sendPromises);

    // Emit alert via Socket.io if available
    try {
      const { emitToAdminClients } = require('../admin-socket-client');
      emitToAdminClients('system:alert', alert);
    } catch (error) {
      // Socket.io not available, continue
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    const axios = require('axios');
    
    const color = {
      [AlertSeverity.CRITICAL]: 'danger',
      [AlertSeverity.WARNING]: 'warning',
      [AlertSeverity.INFO]: 'good'
    }[alert.severity] || 'warning';

    const emoji = {
      [AlertSeverity.CRITICAL]: '🚨',
      [AlertSeverity.WARNING]: '⚠️',
      [AlertSeverity.INFO]: 'ℹ️'
    }[alert.severity] || '⚠️';

    const payload = {
      text: `${emoji} ESSEN Bot Alert: ${alert.name}`,
      attachments: [{
        color,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: new Date(alert.timestamp).toLocaleString(),
            short: true
          },
          {
            title: 'Message',
            value: alert.message,
            short: false
          }
        ]
      }]
    };

    await axios.post(process.env.SLACK_WEBHOOK_URL, payload);
    
    loggers.monitoring.info('Slack alert sent', { alert: alert.name });
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    // This would require email service setup (nodemailer, SendGrid, etc.)
    loggers.monitoring.info('Email alert would be sent', { alert: alert.name });
    
    // Example implementation:
    /*
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.ALERT_FROM_EMAIL,
      to: process.env.ALERT_TO_EMAIL,
      subject: `[${alert.severity.toUpperCase()}] ESSEN Bot Alert: ${alert.name}`,
      html: `
        <h2>ESSEN Bot Alert</h2>
        <p><strong>Alert:</strong> ${alert.name}</p>
        <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
        <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
      `
    });
    */
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    const axios = require('axios');
    
    await axios.post(process.env.ALERT_WEBHOOK_URL, {
      service: 'essen-facebook-bot',
      alert
    });
    
    loggers.monitoring.info('Webhook alert sent', { alert: alert.name });
  }

  /**
   * Send log alert
   */
  async sendLogAlert(alert) {
    const logLevel = {
      [AlertSeverity.CRITICAL]: 'error',
      [AlertSeverity.WARNING]: 'warn',
      [AlertSeverity.INFO]: 'info'
    }[alert.severity] || 'warn';

    loggers.monitoring[logLevel]('ALERT', {
      name: alert.name,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp
    });
  }

  /**
   * Test alert system
   */
  async testAlerts() {
    const testAlert = {
      name: 'AlertSystemTest',
      severity: AlertSeverity.INFO,
      message: 'This is a test alert to verify the alerting system is working',
      timestamp: new Date().toISOString()
    };

    const enabledChannels = Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.enabled)
      .map(([name, _]) => name);

    loggers.monitoring.info('Testing alert system', { 
      channels: enabledChannels 
    });

    for (const [channelName, channel] of this.channels) {
      if (channel.enabled) {
        try {
          await channel.send(testAlert);
          loggers.monitoring.info('Alert test successful', { channel: channelName });
        } catch (error) {
          loggers.monitoring.error('Alert test failed', { 
            channel: channelName, 
            error: error.message 
          });
        }
      }
    }
  }

  /**
   * Get alert status
   */
  getStatus() {
    const channels = Array.from(this.channels.entries()).map(([name, channel]) => ({
      name,
      enabled: channel.enabled
    }));

    const activeCooldowns = Array.from(alertCooldowns.entries()).map(([rule, lastAlert]) => ({
      rule,
      lastAlert: new Date(lastAlert).toISOString(),
      remainingMs: Math.max(0, (lastAlert + alertRules.find(r => r.name === rule)?.cooldown || 0) - Date.now())
    }));

    return {
      channels,
      activeCooldowns,
      totalRules: alertRules.length
    };
  }
}

// Create singleton instance
const alertManager = new AlertManager();

module.exports = {
  AlertSeverity,
  AlertChannels,
  alertManager,
  alertRules
};