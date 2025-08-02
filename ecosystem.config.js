module.exports = {
  apps: [{
    name: 'facebook-bot',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '800M',
    min_uptime: '15s',
    max_restarts: 3,
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Template caching settings
      TEMPLATE_CACHE_TTL: '3600',
      TEMPLATE_CACHE_MAX_SIZE: '100',
      // Human-like response delays
      TYPING_DELAY_MIN: '1000',
      TYPING_DELAY_MAX: '5000',
      RESPONSE_DELAY_FACTOR: '1.2',
      // Performance monitoring
      ENABLE_PERFORMANCE_METRICS: 'true',
      LOG_LEVEL: 'info'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Enhanced health check configuration for Socket.io
    health_check_grace_period: 5000,
    // Kill timeout increased for graceful Socket.io disconnection
    kill_timeout: 10000,
    // Listen timeout for Socket.io connections
    listen_timeout: 12000,
    // Enhanced memory allocation for template caching and Socket.io
    node_args: [
      '--max-old-space-size=700',
      '--optimize-for-size',
      '--gc-interval=100'
    ].join(' '),
    // Exponential backoff restart delay
    exp_backoff_restart_delay: 200,
    // Enhanced monitoring
    pmx: true,
    // Socket.io graceful shutdown
    shutdown_with_message: true,
    wait_ready: true,
    // Performance optimizations
    treekill: true,
    // Log rotation
    log_type: 'json',
    // CPU and memory monitoring thresholds
    max_cpu_usage: 85,
    memory_threshold: 750
  }]
};