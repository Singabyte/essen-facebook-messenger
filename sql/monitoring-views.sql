-- ESSEN Facebook Messenger Bot - Monitoring Views
-- This script creates monitoring views for system health and performance tracking

-- Database performance monitoring view
CREATE OR REPLACE VIEW analytics.v_database_performance AS
SELECT 
    current_database() as database_name,
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') as active_queries,
    (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle in transaction') as idle_in_transaction,
    (SELECT COALESCE(sum(numbackends), 0) FROM pg_stat_database WHERE datname = current_database()) as total_connections,
    (SELECT COALESCE(sum(xact_commit), 0) FROM pg_stat_database WHERE datname = current_database()) as total_commits,
    (SELECT COALESCE(sum(xact_rollback), 0) FROM pg_stat_database WHERE datname = current_database()) as total_rollbacks,
    (SELECT COALESCE(sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0) * 100, 0) FROM pg_stat_database WHERE datname = current_database()) as cache_hit_ratio,
    (SELECT COALESCE(sum(tup_returned), 0) FROM pg_stat_database WHERE datname = current_database()) as rows_returned,
    (SELECT COALESCE(sum(tup_fetched), 0) FROM pg_stat_database WHERE datname = current_database()) as rows_fetched,
    (SELECT COALESCE(sum(tup_inserted), 0) FROM pg_stat_database WHERE datname = current_database()) as rows_inserted,
    (SELECT COALESCE(sum(tup_updated), 0) FROM pg_stat_database WHERE datname = current_database()) as rows_updated,
    (SELECT COALESCE(sum(tup_deleted), 0) FROM pg_stat_database WHERE datname = current_database()) as rows_deleted,
    now() as last_checked;

-- Slow query monitoring view
CREATE OR REPLACE VIEW analytics.v_slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    min_time,
    max_time,
    stddev_time,
    rows,
    CASE 
        WHEN calls > 0 THEN ROUND(total_time::numeric / calls, 2)
        ELSE 0
    END as avg_time_ms,
    CASE
        WHEN mean_time > 1000 THEN 'CRITICAL'
        WHEN mean_time > 500 THEN 'WARNING'
        ELSE 'OK'
    END as performance_status
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
    AND query NOT LIKE '%information_schema%'
    AND mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;

-- Table size and bloat monitoring
CREATE OR REPLACE VIEW analytics.v_table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
    CASE 
        WHEN pg_relation_size(schemaname||'.'||tablename) > 0 
        THEN ROUND((pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename))::numeric / pg_relation_size(schemaname||'.'||tablename) * 100, 2)
        ELSE 0
    END as index_ratio_percent,
    (SELECT count(*) FROM pg_indexes WHERE schemaname = t.schemaname AND tablename = t.tablename) as index_count
FROM pg_tables t
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage monitoring
CREATE OR REPLACE VIEW analytics.v_index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'RARELY_USED'
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- Real-time activity monitoring
CREATE OR REPLACE VIEW analytics.v_current_activity AS
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    backend_start,
    state,
    state_change,
    CASE 
        WHEN state = 'active' THEN now() - query_start
        ELSE NULL
    END as query_duration,
    wait_event_type,
    wait_event,
    LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
    AND pid != pg_backend_pid()
ORDER BY 
    CASE state 
        WHEN 'active' THEN 1
        WHEN 'idle in transaction' THEN 2
        ELSE 3
    END,
    query_start DESC;

-- Lock monitoring view
CREATE OR REPLACE VIEW analytics.v_blocking_locks AS
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement,
    blocked_activity.application_name AS blocked_application,
    blocking_activity.application_name AS blocking_application,
    now() - blocked_activity.query_start AS blocked_duration,
    now() - blocking_activity.query_start AS blocking_duration
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- User engagement monitoring
CREATE OR REPLACE VIEW analytics.v_user_engagement_summary AS
SELECT 
    customer_segment,
    COUNT(*) as user_count,
    AVG(total_conversations) as avg_conversations,
    AVG(total_messages) as avg_messages,
    AVG(total_appointments) as avg_appointments,
    AVG(confirmed_appointments) as avg_confirmed_appointments,
    AVG(engagement_score) as avg_engagement_score,
    MIN(first_interaction) as earliest_user,
    MAX(last_interaction) as most_recent_activity
FROM analytics.user_engagement
GROUP BY customer_segment
ORDER BY avg_engagement_score DESC;

-- System health summary view
CREATE OR REPLACE VIEW analytics.v_system_health AS
SELECT 
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    CASE 
        WHEN pg_database_size(current_database()) > 10737418240 THEN 'WARNING' -- > 10GB
        ELSE 'OK'
    END as status
UNION ALL
SELECT 
    'Active Connections',
    count(*)::text,
    CASE 
        WHEN count(*) > 90 THEN 'CRITICAL'
        WHEN count(*) > 70 THEN 'WARNING'
        ELSE 'OK'
    END
FROM pg_stat_activity
WHERE datname = current_database()
UNION ALL
SELECT 
    'Cache Hit Ratio',
    ROUND(sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0) * 100, 2) || '%',
    CASE 
        WHEN sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0) < 0.9 THEN 'WARNING'
        ELSE 'OK'
    END
FROM pg_stat_database
WHERE datname = current_database()
UNION ALL
SELECT 
    'Long Running Queries',
    count(*)::text,
    CASE 
        WHEN count(*) > 5 THEN 'WARNING'
        WHEN count(*) > 10 THEN 'CRITICAL'
        ELSE 'OK'
    END
FROM pg_stat_activity
WHERE datname = current_database()
    AND state = 'active'
    AND now() - query_start > interval '5 minutes'
UNION ALL
SELECT 
    'Blocked Queries',
    count(*)::text,
    CASE 
        WHEN count(*) > 0 THEN 'CRITICAL'
        ELSE 'OK'
    END
FROM analytics.v_blocking_locks
UNION ALL
SELECT 
    'Failed Transactions (24h)',
    COALESCE(sum(xact_rollback), 0)::text,
    CASE 
        WHEN COALESCE(sum(xact_rollback), 0) > 100 THEN 'WARNING'
        ELSE 'OK'
    END
FROM pg_stat_database
WHERE datname = current_database()
    AND stats_reset > now() - interval '24 hours';

-- Conversation health monitoring
CREATE OR REPLACE VIEW analytics.v_conversation_health AS
SELECT 
    date_trunc('hour', c.created_at) as hour,
    COUNT(DISTINCT c.user_id) as unique_users,
    COUNT(c.id) as total_messages,
    AVG(CASE WHEN c.is_from_user = false THEN 1 ELSE 0 END) as bot_response_rate,
    AVG(
        CASE 
            WHEN c.is_from_user = false AND prev.is_from_user = true 
            THEN EXTRACT(EPOCH FROM (c.created_at - prev.created_at))
        END
    ) as avg_response_time_seconds,
    COUNT(CASE WHEN c.message LIKE '/%' THEN 1 END) as command_count,
    COUNT(CASE WHEN c.message ILIKE '%error%' OR c.message ILIKE '%sorry%' THEN 1 END) as potential_errors
FROM conversations c
LEFT JOIN LATERAL (
    SELECT is_from_user, created_at
    FROM conversations
    WHERE user_id = c.user_id 
        AND created_at < c.created_at
        AND is_from_user = true
    ORDER BY created_at DESC
    LIMIT 1
) prev ON true
WHERE c.created_at >= now() - interval '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Alert summary view
CREATE OR REPLACE VIEW analytics.v_alert_summary AS
SELECT 
    alert_type,
    severity,
    COUNT(*) as total_alerts,
    COUNT(CASE WHEN resolved = false THEN 1 END) as unresolved_alerts,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence,
    AVG(CASE WHEN resolved THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/60 END) as avg_resolution_time_minutes
FROM analytics.alert_history
WHERE created_at >= now() - interval '7 days'
GROUP BY alert_type, severity
ORDER BY unresolved_alerts DESC, total_alerts DESC;

-- Create composite monitoring dashboard view
CREATE OR REPLACE VIEW analytics.v_monitoring_dashboard AS
WITH system_metrics AS (
    SELECT * FROM analytics.v_system_health
),
database_metrics AS (
    SELECT * FROM analytics.v_database_performance
),
conversation_metrics AS (
    SELECT 
        COUNT(DISTINCT user_id) as active_users_24h,
        COUNT(*) as messages_24h,
        AVG(CASE WHEN is_from_user = false THEN 1 ELSE 0 END) as bot_response_rate
    FROM conversations
    WHERE created_at >= now() - interval '24 hours'
),
appointment_metrics AS (
    SELECT 
        COUNT(*) as appointments_24h,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_24h,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_24h
    FROM appointments
    WHERE created_at >= now() - interval '24 hours'
)
SELECT 
    jsonb_build_object(
        'system_health', (SELECT jsonb_agg(row_to_json(s)) FROM system_metrics s),
        'database_performance', (SELECT row_to_json(d) FROM database_metrics d),
        'conversation_metrics', (SELECT row_to_json(c) FROM conversation_metrics c),
        'appointment_metrics', (SELECT row_to_json(a) FROM appointment_metrics a),
        'timestamp', now()
    ) as dashboard_data;

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO admin_user;
GRANT SELECT ON ALL VIEWS IN SCHEMA analytics TO admin_user;