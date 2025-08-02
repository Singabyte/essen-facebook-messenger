const client = require('prom-client');
const { loggers } = require('./logger');

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'essen_bot_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  eventLoopMonitoringPrecision: 10
});

// Custom metrics for the ESSEN Facebook Messenger Bot

// HTTP Request metrics
const httpRequestDuration = new client.Histogram({
  name: 'essen_bot_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const httpRequestsTotal = new client.Counter({
  name: 'essen_bot_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Facebook API metrics
const facebookMessagesReceived = new client.Counter({
  name: 'essen_bot_facebook_messages_received_total',
  help: 'Total number of messages received from Facebook'
});

const facebookMessagesSent = new client.Counter({
  name: 'essen_bot_facebook_messages_sent_total',
  help: 'Total number of messages sent to Facebook'
});

const facebookApiErrors = new client.Counter({
  name: 'essen_bot_facebook_api_errors_total',
  help: 'Total number of Facebook API errors',
  labelNames: ['error_type']
});

const facebookApiDuration = new client.Histogram({
  name: 'essen_bot_facebook_api_duration_seconds',
  help: 'Facebook API request duration',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10]
});

// Gemini AI metrics
const geminiApiRequests = new client.Counter({
  name: 'essen_bot_gemini_api_requests_total',
  help: 'Total number of Gemini AI API requests'
});

const geminiApiErrors = new client.Counter({
  name: 'essen_bot_gemini_api_errors_total',
  help: 'Total number of Gemini AI API errors',
  labelNames: ['error_type']
});

const geminiApiDuration = new client.Histogram({
  name: 'essen_bot_gemini_api_duration_seconds',
  help: 'Gemini AI API request duration',
  buckets: [0.5, 1, 2, 5, 10, 20, 30]
});

const geminiTokensUsed = new client.Counter({
  name: 'essen_bot_gemini_tokens_used_total',
  help: 'Total number of tokens used in Gemini API requests',
  labelNames: ['type'] // input, output
});

// Database metrics
const databaseConnections = new client.Gauge({
  name: 'essen_bot_database_connections_active',
  help: 'Number of active database connections'
});

const databaseQueryDuration = new client.Histogram({
  name: 'essen_bot_database_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['query_type'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2]
});

const databaseQueriesTotal = new client.Counter({
  name: 'essen_bot_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['query_type', 'status']
});

// Socket.io metrics
const socketioConnections = new client.Gauge({
  name: 'essen_bot_socketio_connected_clients',
  help: 'Number of connected Socket.io clients'
});

const socketioConnectionStatus = new client.Gauge({
  name: 'essen_bot_socketio_connection_status',
  help: 'Socket.io connection status (1 = connected, 0 = disconnected)'
});

const socketioMessages = new client.Counter({
  name: 'essen_bot_socketio_messages_total',
  help: 'Total number of Socket.io messages',
  labelNames: ['direction', 'event'] // direction: in/out, event: message type
});

const socketioErrors = new client.Counter({
  name: 'essen_bot_socketio_errors_total',
  help: 'Total number of Socket.io errors',
  labelNames: ['error_type']
});

// Template cache metrics
const templateCacheHitRatio = new client.Gauge({
  name: 'essen_bot_template_cache_hit_ratio',
  help: 'Template cache hit ratio'
});

const templateCacheSize = new client.Gauge({
  name: 'essen_bot_template_cache_size',
  help: 'Number of items in template cache'
});

const templateCacheRequests = new client.Counter({
  name: 'essen_bot_template_cache_requests_total',
  help: 'Total number of template cache requests',
  labelNames: ['result'] // hit, miss
});

const templateCacheEvictions = new client.Counter({
  name: 'essen_bot_template_cache_evictions_total',
  help: 'Total number of template cache evictions'
});

const templateRenderDuration = new client.Histogram({
  name: 'essen_bot_template_render_duration_seconds',
  help: 'Template rendering duration',
  labelNames: ['template_type'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25]
});

// Human intervention metrics
const humanInterventionPending = new client.Gauge({
  name: 'essen_bot_human_intervention_pending_count',
  help: 'Number of pending human interventions'
});

const humanInterventionResponseTime = new client.Histogram({
  name: 'essen_bot_human_intervention_response_duration_seconds',
  help: 'Human intervention response time',
  buckets: [30, 60, 300, 600, 1800, 3600] // 30s to 1h
});

const humanInterventionTotal = new client.Counter({
  name: 'essen_bot_human_intervention_total',
  help: 'Total number of human interventions',
  labelNames: ['status'] // resolved, escalated, timeout
});

// Business metrics
const conversationsStarted = new client.Counter({
  name: 'essen_bot_conversations_started_total',
  help: 'Total number of conversations started'
});

const conversationsCompleted = new client.Counter({
  name: 'essen_bot_conversations_completed_total',
  help: 'Total number of successful conversations',
  labelNames: ['outcome'] // appointment_booked, information_provided, escalated
});

const appointmentsCreated = new client.Counter({
  name: 'essen_bot_appointments_created_total',
  help: 'Total number of appointments created'
});

const appointmentsCancelled = new client.Counter({
  name: 'essen_bot_appointments_cancelled_total',
  help: 'Total number of appointments cancelled'
});

const commandsExecuted = new client.Counter({
  name: 'essen_bot_commands_executed_total',
  help: 'Total number of bot commands executed',
  labelNames: ['command']
});

// System health metrics
const systemHealthStatus = new client.Gauge({
  name: 'essen_bot_system_health_status',
  help: 'System health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['component']
});

const deploymentTimestamp = new client.Gauge({
  name: 'essen_bot_deployment_timestamp',
  help: 'Timestamp of last deployment'
});

// Register all metrics
[
  httpRequestDuration,
  httpRequestsTotal,
  facebookMessagesReceived,
  facebookMessagesSent,
  facebookApiErrors,
  facebookApiDuration,
  geminiApiRequests,
  geminiApiErrors,
  geminiApiDuration,
  geminiTokensUsed,
  databaseConnections,
  databaseQueryDuration,
  databaseQueriesTotal,
  socketioConnections,
  socketioConnectionStatus,
  socketioMessages,
  socketioErrors,
  templateCacheHitRatio,
  templateCacheSize,
  templateCacheRequests,
  templateCacheEvictions,
  templateRenderDuration,
  humanInterventionPending,
  humanInterventionResponseTime,
  humanInterventionTotal,
  conversationsStarted,
  conversationsCompleted,
  appointmentsCreated,
  appointmentsCancelled,
  commandsExecuted,
  systemHealthStatus,
  deploymentTimestamp
].forEach(metric => register.registerMetric(metric));

// Utility functions for metrics collection
const metricsCollector = {
  // HTTP request tracking
  recordHttpRequest: (method, route, statusCode, duration) => {
    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestsTotal.labels(method, route, statusCode).inc();
    
    loggers.monitoring.debug('HTTP request recorded', {
      method,
      route,
      statusCode,
      duration
    });
  },

  // Facebook API tracking
  recordFacebookMessage: (direction) => {
    if (direction === 'received') {
      facebookMessagesReceived.inc();
    } else if (direction === 'sent') {
      facebookMessagesSent.inc();
    }
  },

  recordFacebookApiCall: (endpoint, duration, error = null) => {
    facebookApiDuration.labels(endpoint).observe(duration);
    if (error) {
      facebookApiErrors.labels(error.type || 'unknown').inc();
    }
  },

  // Gemini AI tracking
  recordGeminiRequest: (duration, tokensUsed = {}, error = null) => {
    geminiApiRequests.inc();
    geminiApiDuration.observe(duration);
    
    if (tokensUsed.input) geminiTokensUsed.labels('input').inc(tokensUsed.input);
    if (tokensUsed.output) geminiTokensUsed.labels('output').inc(tokensUsed.output);
    
    if (error) {
      geminiApiErrors.labels(error.type || 'unknown').inc();
    }
  },

  // Database tracking
  recordDatabaseQuery: (queryType, duration, success = true) => {
    databaseQueryDuration.labels(queryType).observe(duration);
    databaseQueriesTotal.labels(queryType, success ? 'success' : 'error').inc();
  },

  updateDatabaseConnections: (count) => {
    databaseConnections.set(count);
  },

  // Socket.io tracking
  recordSocketioMessage: (direction, event) => {
    socketioMessages.labels(direction, event).inc();
  },

  updateSocketioConnections: (count) => {
    socketioConnections.set(count);
  },

  updateSocketioStatus: (connected) => {
    socketioConnectionStatus.set(connected ? 1 : 0);
  },

  recordSocketioError: (errorType) => {
    socketioErrors.labels(errorType).inc();
  },

  // Template cache tracking
  updateTemplateCacheStats: (hitRatio, size) => {
    templateCacheHitRatio.set(hitRatio);
    templateCacheSize.set(size);
  },

  recordTemplateCacheRequest: (isHit) => {
    templateCacheRequests.labels(isHit ? 'hit' : 'miss').inc();
  },

  recordTemplateCacheEviction: () => {
    templateCacheEvictions.inc();
  },

  recordTemplateRender: (templateType, duration) => {
    templateRenderDuration.labels(templateType).observe(duration);
  },

  // Human intervention tracking
  updateHumanInterventionPending: (count) => {
    humanInterventionPending.set(count);
  },

  recordHumanInterventionResponse: (duration, status) => {
    humanInterventionResponseTime.observe(duration);
    humanInterventionTotal.labels(status).inc();
  },

  // Business metrics
  recordConversationStart: () => {
    conversationsStarted.inc();
  },

  recordConversationComplete: (outcome) => {
    conversationsCompleted.labels(outcome).inc();
  },

  recordAppointment: (action) => {
    if (action === 'created') {
      appointmentsCreated.inc();
    } else if (action === 'cancelled') {
      appointmentsCancelled.inc();
    }
  },

  recordCommand: (command) => {
    commandsExecuted.labels(command).inc();
  },

  // System health
  updateSystemHealth: (component, healthy) => {
    systemHealthStatus.labels(component).set(healthy ? 1 : 0);
  },

  recordDeployment: () => {
    deploymentTimestamp.set(Date.now() / 1000);
  }
};

// Initialize deployment timestamp
metricsCollector.recordDeployment();

module.exports = {
  register,
  metrics: {
    httpRequestDuration,
    httpRequestsTotal,
    facebookMessagesReceived,
    facebookMessagesSent,
    facebookApiErrors,
    facebookApiDuration,
    geminiApiRequests,
    geminiApiErrors,
    geminiApiDuration,
    geminiTokensUsed,
    databaseConnections,
    databaseQueryDuration,
    databaseQueriesTotal,
    socketioConnections,
    socketioConnectionStatus,
    socketioMessages,
    socketioErrors,
    templateCacheHitRatio,
    templateCacheSize,
    templateCacheRequests,
    templateCacheEvictions,
    templateRenderDuration,
    humanInterventionPending,
    humanInterventionResponseTime,
    humanInterventionTotal,
    conversationsStarted,
    conversationsCompleted,
    appointmentsCreated,
    appointmentsCancelled,
    commandsExecuted,
    systemHealthStatus,
    deploymentTimestamp
  },
  metricsCollector
};