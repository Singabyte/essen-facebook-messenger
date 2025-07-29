#!/bin/bash

# Monitoring script for Facebook Messenger Bot

# Check bot health
check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
    if [ $response -ne 200 ]; then
        return 1
    fi
    return 0
}

# Send alert (customize based on your notification preference)
send_alert() {
    local message=$1
    echo "[$(date)] ALERT: $message" >> /var/log/bot-alerts.log
    # Add email/slack notification here if needed
}

# Main monitoring loop
echo "Starting bot monitoring..."

# Check if bot is healthy
if ! check_health; then
    echo "Bot health check failed. Attempting restart..."
    pm2 restart facebook-bot
    
    # Wait for restart
    sleep 10
    
    # Check again
    if ! check_health; then
        send_alert "Bot failed to restart. Manual intervention required."
        exit 1
    else
        send_alert "Bot was down but has been successfully restarted."
    fi
fi

# Check memory usage
memory_usage=$(pm2 jlist | jq -r '.[] | select(.name=="facebook-bot") | .monit.memory')
memory_mb=$((memory_usage / 1024 / 1024))

if [ $memory_mb -gt 500 ]; then
    send_alert "High memory usage detected: ${memory_mb}MB"
fi

# Check error logs
error_count=$(pm2 logs facebook-bot --err --lines 100 --nostream | grep -c "Error" || true)
if [ $error_count -gt 10 ]; then
    send_alert "High error rate detected: $error_count errors in last 100 log lines"
fi

echo "Monitoring check completed successfully."