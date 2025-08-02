#!/bin/bash

# Enhanced Monitoring script for Facebook Messenger Bot with Socket.io and Template Cache monitoring

# Configuration
BOT_URL="http://localhost:3000"
ADMIN_API_URL="http://localhost:4000"
LOG_FILE="/var/log/bot-alerts.log"
METRICS_FILE="/var/log/bot-metrics.log"
MEMORY_THRESHOLD=700
ERROR_THRESHOLD=10
RESPONSE_TIME_THRESHOLD=2000
TEMPLATE_CACHE_HIT_RATIO_THRESHOLD=0.8

# Create log files if they don't exist
mkdir -p /var/log
touch $LOG_FILE $METRICS_FILE

# Check bot health
check_health() {
    local url=$1
    local service_name=$2
    
    start_time=$(date +%s%N)
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url/health")
    end_time=$(date +%s%N)
    
    response_time=$(( (end_time - start_time) / 1000000 ))
    
    echo "$service_name response time: ${response_time}ms"
    
    if [ $response -ne 200 ]; then
        return 1
    fi
    
    if [ $response_time -gt $RESPONSE_TIME_THRESHOLD ]; then
        send_alert "$service_name slow response: ${response_time}ms (threshold: ${RESPONSE_TIME_THRESHOLD}ms)"
    fi
    
    return 0
}

# Check Socket.io connectivity
check_socketio() {
    echo "Checking Socket.io connectivity..."
    
    # Check admin socket status
    socket_status=$(curl -s "$ADMIN_API_URL/debug/socket-status" 2>/dev/null | jq -r '.connected' 2>/dev/null || echo "false")
    
    if [ "$socket_status" = "true" ]; then
        echo "✅ Socket.io connectivity: OK"
        log_metric "socketio_connected" 1
    else
        echo "❌ Socket.io connectivity: FAILED"
        log_metric "socketio_connected" 0
        send_alert "Socket.io connection failed"
        return 1
    fi
    
    # Check socket connection count
    connection_count=$(curl -s "$ADMIN_API_URL/debug/socket-connections" 2>/dev/null | jq -r '.count' 2>/dev/null || echo "0")
    echo "Socket.io connections: $connection_count"
    log_metric "socketio_connections" "$connection_count"
    
    return 0
}

# Check template cache performance
check_template_cache() {
    echo "Checking template cache performance..."
    
    cache_stats=$(curl -s "$BOT_URL/debug/template-cache-stats" 2>/dev/null || echo '{}')
    
    if [ "$cache_stats" = "{}" ]; then
        echo "⚠️ Template cache stats unavailable"
        return 1
    fi
    
    hit_ratio=$(echo $cache_stats | jq -r '.hitRatio // 0' 2>/dev/null || echo "0")
    cache_size=$(echo $cache_stats | jq -r '.size // 0' 2>/dev/null || echo "0")
    total_requests=$(echo $cache_stats | jq -r '.totalRequests // 0' 2>/dev/null || echo "0")
    
    echo "Template cache hit ratio: $hit_ratio"
    echo "Template cache size: $cache_size"
    echo "Template cache total requests: $total_requests"
    
    log_metric "template_cache_hit_ratio" "$hit_ratio"
    log_metric "template_cache_size" "$cache_size"
    log_metric "template_cache_requests" "$total_requests"
    
    # Check if hit ratio is below threshold
    if (( $(echo "$hit_ratio < $TEMPLATE_CACHE_HIT_RATIO_THRESHOLD" | bc -l) )); then
        send_alert "Low template cache hit ratio: $hit_ratio (threshold: $TEMPLATE_CACHE_HIT_RATIO_THRESHOLD)"
    fi
    
    return 0
}

# Check human intervention metrics
check_human_intervention() {
    echo "Checking human intervention system..."
    
    intervention_stats=$(curl -s "$BOT_URL/debug/human-intervention-stats" 2>/dev/null || echo '{}')
    
    if [ "$intervention_stats" = "{}" ]; then
        echo "⚠️ Human intervention stats unavailable"
        return 1
    fi
    
    pending_count=$(echo $intervention_stats | jq -r '.pendingCount // 0' 2>/dev/null || echo "0")
    avg_response_time=$(echo $intervention_stats | jq -r '.avgResponseTime // 0' 2>/dev/null || echo "0")
    total_interventions=$(echo $intervention_stats | jq -r '.totalInterventions // 0' 2>/dev/null || echo "0")
    
    echo "Pending human interventions: $pending_count"
    echo "Average human response time: ${avg_response_time}ms"
    echo "Total interventions today: $total_interventions"
    
    log_metric "human_intervention_pending" "$pending_count"
    log_metric "human_intervention_avg_time" "$avg_response_time"
    log_metric "human_intervention_total" "$total_interventions"
    
    # Alert if too many pending interventions
    if [ "$pending_count" -gt 5 ]; then
        send_alert "High number of pending human interventions: $pending_count"
    fi
    
    return 0
}

# Enhanced memory and CPU monitoring
check_system_resources() {
    echo "Checking system resources..."
    
    # PM2 process monitoring
    if command -v pm2 >/dev/null 2>&1; then
        memory_usage=$(pm2 jlist | jq -r '.[] | select(.name=="facebook-bot") | .monit.memory' 2>/dev/null || echo "0")
        cpu_usage=$(pm2 jlist | jq -r '.[] | select(.name=="facebook-bot") | .monit.cpu' 2>/dev/null || echo "0")
        
        memory_mb=$((memory_usage / 1024 / 1024))
        
        echo "Memory usage: ${memory_mb}MB"
        echo "CPU usage: ${cpu_usage}%"
        
        log_metric "memory_usage_mb" "$memory_mb"
        log_metric "cpu_usage_percent" "$cpu_usage"
        
        if [ $memory_mb -gt $MEMORY_THRESHOLD ]; then
            send_alert "High memory usage detected: ${memory_mb}MB (threshold: ${MEMORY_THRESHOLD}MB)"
        fi
        
        if (( $(echo "$cpu_usage > 80" | bc -l) )); then
            send_alert "High CPU usage detected: ${cpu_usage}%"
        fi
    fi
    
    # System-wide metrics if available
    if command -v free >/dev/null 2>&1; then
        system_memory=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
        echo "System memory usage: ${system_memory}%"
        log_metric "system_memory_percent" "$system_memory"
    fi
    
    return 0
}

# Enhanced error log analysis
check_error_logs() {
    echo "Analyzing error logs..."
    
    if command -v pm2 >/dev/null 2>&1; then
        # Check recent errors
        error_count=$(pm2 logs facebook-bot --err --lines 100 --nostream 2>/dev/null | grep -c "Error" || echo "0")
        warning_count=$(pm2 logs facebook-bot --out --lines 100 --nostream 2>/dev/null | grep -c "WARN" || echo "0")
        socket_errors=$(pm2 logs facebook-bot --err --lines 100 --nostream 2>/dev/null | grep -ic "socket" || echo "0")
        
        echo "Recent errors: $error_count"
        echo "Recent warnings: $warning_count"
        echo "Socket-related errors: $socket_errors"
        
        log_metric "error_count" "$error_count"
        log_metric "warning_count" "$warning_count"
        log_metric "socket_errors" "$socket_errors"
        
        if [ $error_count -gt $ERROR_THRESHOLD ]; then
            send_alert "High error rate detected: $error_count errors in last 100 log lines"
        fi
        
        if [ $socket_errors -gt 3 ]; then
            send_alert "Multiple Socket.io errors detected: $socket_errors errors"
        fi
    fi
    
    return 0
}

# Database performance check
check_database_performance() {
    echo "Checking database performance..."
    
    db_stats=$(curl -s "$BOT_URL/debug/database-stats" 2>/dev/null || echo '{}')
    
    if [ "$db_stats" != "{}" ]; then
        connection_count=$(echo $db_stats | jq -r '.connectionCount // 0' 2>/dev/null || echo "0")
        avg_query_time=$(echo $db_stats | jq -r '.avgQueryTime // 0' 2>/dev/null || echo "0")
        
        echo "Database connections: $connection_count"
        echo "Average query time: ${avg_query_time}ms"
        
        log_metric "db_connections" "$connection_count"
        log_metric "db_avg_query_time" "$avg_query_time"
        
        if (( $(echo "$avg_query_time > 1000" | bc -l) )); then
            send_alert "Slow database queries detected: ${avg_query_time}ms"
        fi
    fi
    
    return 0
}

# Send alert (enhanced with different alert levels)
send_alert() {
    local message=$1
    local level=${2:-"WARNING"}
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] $level: $message" >> $LOG_FILE
    echo "🚨 $level: $message"
    
    # Add email/slack notification here if needed
    # Example: curl -X POST -H 'Content-type: application/json' --data '{"text":"Bot Alert: '$message'"}' $SLACK_WEBHOOK_URL
}

# Log metrics with timestamp
log_metric() {
    local metric_name=$1
    local metric_value=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] METRIC: $metric_name=$metric_value" >> $METRICS_FILE
}

# Main monitoring function
main_monitoring() {
    echo "🔍 Starting enhanced bot monitoring at $(date)..."
    echo "=========================================="
    
    # Check basic health
    echo "1. Checking bot health..."
    if ! check_health "$BOT_URL" "Bot"; then
        echo "❌ Bot health check failed. Attempting restart..."
        pm2 restart facebook-bot
        
        sleep 15
        
        if ! check_health "$BOT_URL" "Bot"; then
            send_alert "Bot failed to restart. Manual intervention required." "CRITICAL"
            exit 1
        else
            send_alert "Bot was down but has been successfully restarted." "INFO"
        fi
    else
        echo "✅ Bot health check passed"
    fi
    
    # Check admin API health
    echo "2. Checking admin API health..."
    if ! check_health "$ADMIN_API_URL" "Admin API"; then
        send_alert "Admin API health check failed" "WARNING"
    else
        echo "✅ Admin API health check passed"
    fi
    
    # Check Socket.io
    echo "3. Checking Socket.io..."
    check_socketio
    
    # Check template cache
    echo "4. Checking template cache..."
    check_template_cache
    
    # Check human intervention system
    echo "5. Checking human intervention system..."
    check_human_intervention
    
    # Check system resources
    echo "6. Checking system resources..."
    check_system_resources
    
    # Check error logs
    echo "7. Analyzing error logs..."
    check_error_logs
    
    # Check database performance
    echo "8. Checking database performance..."
    check_database_performance
    
    echo "=========================================="
    echo "✅ Monitoring check completed successfully at $(date)"
    
    # Log monitoring completion
    log_metric "monitoring_completed" 1
}

# Run monitoring
main_monitoring