#!/bin/bash

# Comprehensive Monitoring script for ESSEN Facebook Messenger Bot
# Supports Prometheus metrics, structured logging, and alerting

# Configuration
BOT_URL="${BOT_URL:-http://localhost:3000}"
ADMIN_API_URL="${ADMIN_API_URL:-http://localhost:4000}"
LOG_DIR="${LOG_DIR:-/var/log/essen-bot}"
ALERT_LOG="$LOG_DIR/alerts.log"
METRICS_LOG="$LOG_DIR/metrics.log"
HEALTH_LOG="$LOG_DIR/health-checks.log"

# Thresholds
MEMORY_THRESHOLD=${MEMORY_THRESHOLD:-700}
ERROR_THRESHOLD=${ERROR_THRESHOLD:-10}
RESPONSE_TIME_THRESHOLD=${RESPONSE_TIME_THRESHOLD:-2000}
TEMPLATE_CACHE_HIT_RATIO_THRESHOLD=${TEMPLATE_CACHE_HIT_RATIO_THRESHOLD:-0.8}
HUMAN_INTERVENTION_THRESHOLD=${HUMAN_INTERVENTION_THRESHOLD:-5}

# Slack webhook for alerts (optional)
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Create log directories and files
mkdir -p "$LOG_DIR"
touch "$ALERT_LOG" "$METRICS_LOG" "$HEALTH_LOG"

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

# Send alert (enhanced with different alert levels and Slack integration)
send_alert() {
    local message=$1
    local level=${2:-"WARNING"}
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] $level: $message" >> "$ALERT_LOG"
    echo "🚨 $level: $message"
    
    # Send to Slack if webhook URL is configured
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        send_slack_alert "$message" "$level"
    fi
}

# Send Slack alert
send_slack_alert() {
    local message=$1
    local level=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Determine emoji and color based on level
    local emoji color
    case "$level" in
        "CRITICAL")
            emoji="🚨"
            color="danger"
            ;;
        "WARNING")
            emoji="⚠️"
            color="warning"
            ;;
        "INFO")
            emoji="ℹ️"
            color="good"
            ;;
        *)
            emoji="🔔"
            color="#36a64f"
            ;;
    esac
    
    # Create Slack payload
    local payload=$(cat <<EOF
{
    "text": "${emoji} ESSEN Bot Alert: ${level}",
    "attachments": [
        {
            "color": "${color}",
            "fields": [
                {
                    "title": "Severity",
                    "value": "${level}",
                    "short": true
                },
                {
                    "title": "Time",
                    "value": "${timestamp}",
                    "short": true
                },
                {
                    "title": "Message",
                    "value": "${message}",
                    "short": false
                },
                {
                    "title": "Host",
                    "value": "$(hostname)",
                    "short": true
                }
            ]
        }
    ]
}
EOF
    )
    
    # Send to Slack
    if curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            --max-time 10 \
            --silent \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1; then
        echo "  📤 Slack alert sent successfully"
        log_health_event "INFO" "slack_alert_sent" "$level: $message"
    else
        echo "  ❌ Failed to send Slack alert"
        log_health_event "WARNING" "slack_alert_failed" "Failed to send $level alert to Slack"
    fi
}

# Log metrics with timestamp
log_metric() {
    local metric_name=$1
    local metric_value=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] METRIC: $metric_name=$metric_value" >> $METRICS_FILE
}

# Comprehensive health check using new endpoints
comprehensive_health_check() {
    echo "🏥 Running comprehensive health check..."
    
    local health_data
    health_data=$(curl -s "$BOT_URL/debug/health-comprehensive" 2>/dev/null)
    
    if [ $? -ne 0 ] || [ "$health_data" = "" ]; then
        log_health_event "CRITICAL" "comprehensive_health_check_failed" "Cannot reach comprehensive health endpoint"
        return 1
    fi
    
    # Parse JSON response
    local overall_health
    overall_health=$(echo "$health_data" | jq -r '.overall // "unknown"' 2>/dev/null)
    
    case "$overall_health" in
        "healthy")
            echo "✅ Overall system health: HEALTHY"
            log_health_event "INFO" "system_health" "healthy"
            ;;
        "degraded")
            echo "⚠️ Overall system health: DEGRADED"
            log_health_event "WARNING" "system_health" "degraded"
            send_alert "System health degraded. Some services may be experiencing issues." "WARNING"
            ;;
        "unhealthy")
            echo "❌ Overall system health: UNHEALTHY"
            log_health_event "CRITICAL" "system_health" "unhealthy"
            send_alert "System health critical. Multiple services are failing." "CRITICAL"
            ;;
        *)
            echo "❓ Overall system health: UNKNOWN"
            log_health_event "WARNING" "system_health" "unknown"
            ;;
    esac
    
    # Check individual services
    echo "$health_data" | jq -r '.services | to_entries[] | "\(.key):\(.value.healthy):\(.value.status):\(.value.error // "none")"' 2>/dev/null | while IFS=: read -r service healthy status error; do
        if [ "$healthy" = "true" ]; then
            echo "  ✅ $service: $status"
        else
            echo "  ❌ $service: $status ($error)"
            log_health_event "ERROR" "service_unhealthy" "$service: $error"
        fi
    done
    
    return 0
}

# Fetch and analyze Prometheus metrics
fetch_prometheus_metrics() {
    echo "📊 Fetching Prometheus metrics..."
    
    local metrics_data
    metrics_data=$(curl -s "$BOT_URL/metrics" 2>/dev/null)
    
    if [ $? -ne 0 ] || [ "$metrics_data" = "" ]; then
        log_health_event "WARNING" "metrics_fetch_failed" "Cannot reach metrics endpoint"
        return 1
    fi
    
    # Extract key metrics
    local memory_usage
    local error_rate
    local response_time
    
    memory_usage=$(echo "$metrics_data" | grep "essen_bot_process_resident_memory_bytes" | awk '{print $2}' | head -1)
    error_rate=$(echo "$metrics_data" | grep "essen_bot_http_requests_total.*5.." | awk '{print $2}' | awk '{sum+=$1} END {print sum/NR}')
    response_time=$(echo "$metrics_data" | grep "essen_bot_http_request_duration_seconds_bucket" | grep "le=\"1\"" | awk '{print $2}' | head -1)
    
    # Convert memory from bytes to MB
    if [ "$memory_usage" != "" ]; then
        memory_mb=$((memory_usage / 1024 / 1024))
        echo "  Memory usage: ${memory_mb}MB"
        log_metric "memory_usage_mb" "$memory_mb"
        
        if [ $memory_mb -gt $MEMORY_THRESHOLD ]; then
            send_alert "High memory usage: ${memory_mb}MB (threshold: ${MEMORY_THRESHOLD}MB)" "CRITICAL"
        fi
    fi
    
    # Log other metrics
    [ "$error_rate" != "" ] && log_metric "error_rate" "$error_rate"
    [ "$response_time" != "" ] && log_metric "response_time" "$response_time"
    
    return 0
}

# Enhanced alerting system
check_alerting_rules() {
    echo "🚨 Checking alerting rules..."
    
    # This would integrate with the Node.js alerting system
    # For now, we'll use basic shell-based checks
    
    # Check if bot is responding
    if ! curl -s "$BOT_URL/health" >/dev/null 2>&1; then
        send_alert "Bot service is not responding" "CRITICAL"
    fi
    
    # Check if admin API is responding
    if ! curl -s "$ADMIN_API_URL/health" >/dev/null 2>&1; then
        send_alert "Admin API is not responding" "WARNING"
    fi
    
    return 0
}

# Enhanced logging functions
log_health_event() {
    local level=$1
    local event=$2
    local message=$3
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    echo "[$timestamp] [$level] $event: $message" >> "$HEALTH_LOG"
}

# Main monitoring function
main_monitoring() {
    local start_time=$(date +%s)
    echo "🔍 Starting comprehensive bot monitoring at $(date)..."
    echo "=========================================="
    
    # 1. Comprehensive health check
    echo "1. Running comprehensive health check..."
    comprehensive_health_check
    
    # 2. Fetch Prometheus metrics
    echo "2. Fetching Prometheus metrics..."
    fetch_prometheus_metrics
    
    # 3. Check specific components (legacy checks for compatibility)
    echo "3. Checking Socket.io..."
    check_socketio
    
    echo "4. Checking template cache..."
    check_template_cache
    
    echo "5. Checking human intervention system..."
    check_human_intervention
    
    echo "6. Checking system resources..."
    check_system_resources
    
    echo "7. Analyzing error logs..."
    check_error_logs
    
    echo "8. Checking database performance..."
    check_database_performance
    
    # 4. Run alerting rules
    echo "9. Checking alerting rules..."
    check_alerting_rules
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo "=========================================="
    echo "✅ Monitoring check completed in ${duration}s at $(date)"
    
    # Log monitoring completion
    log_metric "monitoring_completed" 1
    log_metric "monitoring_duration_seconds" "$duration"
    log_health_event "INFO" "monitoring_completed" "Check completed in ${duration}s"
}

# Run monitoring
main_monitoring