module.exports = {
  apps: [{
    name: 'facebook-bot',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    min_uptime: '10s',
    max_restarts: 5,
    restart_delay: 4000,
    env: {
      NODE_ENV: 'production'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Health check configuration
    health_check_grace_period: 3000,
    // Kill timeout
    kill_timeout: 5000,
    // Listen timeout
    listen_timeout: 8000,
    // DigitalOcean specific optimizations
    node_args: '--max-old-space-size=400',
    // Exponential backoff restart delay
    exp_backoff_restart_delay: 100
  }]
};