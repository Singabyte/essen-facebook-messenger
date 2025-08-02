-- ESSEN Facebook Messenger Bot - Analytics Schema
-- This script creates the analytics tables and views for business intelligence

-- Create analytics schema
CREATE SCHEMA IF NOT EXISTS analytics;

-- Performance metrics table for system monitoring
CREATE TABLE IF NOT EXISTS analytics.performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(10,2) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Query performance tracking
CREATE TABLE IF NOT EXISTS analytics.query_performance (
    id SERIAL PRIMARY KEY,
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT,
    execution_time_ms INTEGER NOT NULL,
    rows_returned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversation analytics with engagement metrics
CREATE TABLE IF NOT EXISTS analytics.conversation_analytics (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    user_id INTEGER REFERENCES users(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    command_count INTEGER DEFAULT 0,
    ai_response_count INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER,
    conversation_score NUMERIC(3,2),
    outcome VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Business metrics daily aggregation
CREATE TABLE IF NOT EXISTS analytics.business_metrics_daily (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL UNIQUE,
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    total_conversations INTEGER DEFAULT 0,
    successful_conversations INTEGER DEFAULT 0,
    total_appointments INTEGER DEFAULT 0,
    confirmed_appointments INTEGER DEFAULT 0,
    cancelled_appointments INTEGER DEFAULT 0,
    avg_conversation_length NUMERIC(10,2),
    avg_response_time_ms INTEGER,
    total_messages INTEGER DEFAULT 0,
    total_commands INTEGER DEFAULT 0,
    popular_products JSONB DEFAULT '[]',
    peak_hours JSONB DEFAULT '[]',
    satisfaction_score NUMERIC(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product inquiry tracking
CREATE TABLE IF NOT EXISTS analytics.product_inquiries (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    product_category VARCHAR(100),
    user_id INTEGER REFERENCES users(id),
    conversation_id INTEGER REFERENCES conversations(id),
    inquiry_type VARCHAR(50),
    inquiry_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    led_to_appointment BOOLEAN DEFAULT FALSE
);

-- User engagement patterns
CREATE TABLE IF NOT EXISTS analytics.user_engagement (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    first_interaction TIMESTAMP,
    last_interaction TIMESTAMP,
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_appointments INTEGER DEFAULT 0,
    confirmed_appointments INTEGER DEFAULT 0,
    favorite_products JSONB DEFAULT '[]',
    engagement_score NUMERIC(5,2),
    customer_segment VARCHAR(50),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert history for monitoring
CREATE TABLE IF NOT EXISTS analytics.alert_history (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_performance_metrics_type_created ON analytics.performance_metrics(metric_type, created_at);
CREATE INDEX idx_query_performance_execution_time ON analytics.query_performance(execution_time_ms DESC);
CREATE INDEX idx_conversation_analytics_user ON analytics.conversation_analytics(user_id, start_time);
CREATE INDEX idx_business_metrics_date ON analytics.business_metrics_daily(metric_date DESC);
CREATE INDEX idx_product_inquiries_product ON analytics.product_inquiries(product_name, inquiry_timestamp);
CREATE INDEX idx_user_engagement_segment ON analytics.user_engagement(customer_segment);
CREATE INDEX idx_alert_history_unresolved ON analytics.alert_history(resolved, created_at) WHERE resolved = FALSE;

-- Create materialized view for user behavior patterns
CREATE MATERIALIZED VIEW analytics.mv_user_behavior_patterns AS
SELECT 
    date_trunc('hour', c.created_at) as hour_slot,
    COUNT(DISTINCT c.user_id) as unique_users,
    COUNT(c.id) as total_messages,
    AVG(LENGTH(c.message)) as avg_message_length,
    COUNT(CASE WHEN c.is_from_user = false THEN 1 END) as bot_responses,
    AVG(CASE 
        WHEN c.is_from_user = false AND lag(c.is_from_user) OVER (PARTITION BY c.user_id ORDER BY c.created_at) = true 
        THEN EXTRACT(EPOCH FROM (c.created_at - lag(c.created_at) OVER (PARTITION BY c.user_id ORDER BY c.created_at))) 
    END) as avg_response_time_seconds
FROM conversations c
WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY hour_slot
ORDER BY hour_slot DESC;

-- Create view for conversion funnel analysis
CREATE OR REPLACE VIEW analytics.v_conversion_funnel AS
SELECT 
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN ue.total_conversations > 0 THEN u.id END) as engaged_users,
    COUNT(DISTINCT CASE WHEN pi.id IS NOT NULL THEN u.id END) as product_inquiry_users,
    COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN u.id END) as appointment_users,
    COUNT(DISTINCT CASE WHEN a.status = 'confirmed' THEN u.id END) as confirmed_appointment_users,
    ROUND(COUNT(DISTINCT CASE WHEN ue.total_conversations > 0 THEN u.id END)::numeric / NULLIF(COUNT(DISTINCT u.id), 0) * 100, 2) as engagement_rate,
    ROUND(COUNT(DISTINCT CASE WHEN pi.id IS NOT NULL THEN u.id END)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN ue.total_conversations > 0 THEN u.id END), 0) * 100, 2) as inquiry_rate,
    ROUND(COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN u.id END)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN pi.id IS NOT NULL THEN u.id END), 0) * 100, 2) as appointment_rate,
    ROUND(COUNT(DISTINCT CASE WHEN a.status = 'confirmed' THEN u.id END)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN u.id END), 0) * 100, 2) as confirmation_rate
FROM users u
LEFT JOIN analytics.user_engagement ue ON u.id = ue.user_id
LEFT JOIN analytics.product_inquiries pi ON u.id = pi.user_id
LEFT JOIN appointments a ON u.id = a.user_id
WHERE u.created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Create view for product trend analysis
CREATE OR REPLACE VIEW analytics.v_product_trends AS
SELECT 
    pi.product_name,
    pi.product_category,
    COUNT(*) as inquiry_count,
    COUNT(DISTINCT pi.user_id) as unique_users,
    COUNT(CASE WHEN pi.led_to_appointment THEN 1 END) as appointments_generated,
    ROUND(COUNT(CASE WHEN pi.led_to_appointment THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as conversion_rate,
    date_trunc('day', MIN(pi.inquiry_timestamp)) as first_inquiry,
    date_trunc('day', MAX(pi.inquiry_timestamp)) as last_inquiry,
    CASE 
        WHEN COUNT(*) > 20 THEN 'Hot'
        WHEN COUNT(*) > 10 THEN 'Warm'
        ELSE 'Cold'
    END as trend_status
FROM analytics.product_inquiries pi
WHERE pi.inquiry_timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY pi.product_name, pi.product_category
ORDER BY inquiry_count DESC;

-- Create function to update business metrics daily
CREATE OR REPLACE FUNCTION analytics.update_business_metrics_daily()
RETURNS void AS $$
BEGIN
    INSERT INTO analytics.business_metrics_daily (
        metric_date,
        total_users,
        new_users,
        active_users,
        total_conversations,
        successful_conversations,
        total_appointments,
        confirmed_appointments,
        cancelled_appointments,
        avg_conversation_length,
        avg_response_time_ms,
        total_messages,
        total_commands,
        popular_products,
        peak_hours,
        satisfaction_score
    )
    SELECT 
        CURRENT_DATE - INTERVAL '1 day',
        COUNT(DISTINCT u.id),
        COUNT(DISTINCT CASE WHEN u.created_at::date = CURRENT_DATE - INTERVAL '1 day' THEN u.id END),
        COUNT(DISTINCT CASE WHEN c.created_at::date = CURRENT_DATE - INTERVAL '1 day' THEN c.user_id END),
        COUNT(DISTINCT ca.conversation_id),
        COUNT(DISTINCT CASE WHEN ca.outcome = 'successful' THEN ca.conversation_id END),
        COUNT(DISTINCT a.id),
        COUNT(DISTINCT CASE WHEN a.status = 'confirmed' THEN a.id END),
        COUNT(DISTINCT CASE WHEN a.status = 'cancelled' THEN a.id END),
        AVG(ca.message_count),
        AVG(ca.avg_response_time_ms),
        COUNT(c.id),
        COUNT(CASE WHEN c.message LIKE '/%' THEN 1 END),
        (SELECT jsonb_agg(product_data) FROM (
            SELECT jsonb_build_object('name', product_name, 'count', COUNT(*)) as product_data
            FROM analytics.product_inquiries 
            WHERE inquiry_timestamp::date = CURRENT_DATE - INTERVAL '1 day'
            GROUP BY product_name 
            ORDER BY COUNT(*) DESC 
            LIMIT 10
        ) popular),
        (SELECT jsonb_agg(hour_data) FROM (
            SELECT jsonb_build_object('hour', EXTRACT(hour FROM created_at), 'count', COUNT(*)) as hour_data
            FROM conversations 
            WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day'
            GROUP BY EXTRACT(hour FROM created_at)
            ORDER BY COUNT(*) DESC
            LIMIT 5
        ) peaks),
        COALESCE(AVG(ca.conversation_score), 4.0)
    FROM users u
    LEFT JOIN conversations c ON u.id = c.user_id AND c.created_at::date = CURRENT_DATE - INTERVAL '1 day'
    LEFT JOIN analytics.conversation_analytics ca ON ca.start_time::date = CURRENT_DATE - INTERVAL '1 day'
    LEFT JOIN appointments a ON a.created_at::date = CURRENT_DATE - INTERVAL '1 day'
    ON CONFLICT (metric_date) 
    DO UPDATE SET
        total_users = EXCLUDED.total_users,
        new_users = EXCLUDED.new_users,
        active_users = EXCLUDED.active_users,
        total_conversations = EXCLUDED.total_conversations,
        successful_conversations = EXCLUDED.successful_conversations,
        total_appointments = EXCLUDED.total_appointments,
        confirmed_appointments = EXCLUDED.confirmed_appointments,
        cancelled_appointments = EXCLUDED.cancelled_appointments,
        avg_conversation_length = EXCLUDED.avg_conversation_length,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms,
        total_messages = EXCLUDED.total_messages,
        total_commands = EXCLUDED.total_commands,
        popular_products = EXCLUDED.popular_products,
        peak_hours = EXCLUDED.peak_hours,
        satisfaction_score = EXCLUDED.satisfaction_score;
END;
$$ LANGUAGE plpgsql;

-- Create function to segment users
CREATE OR REPLACE FUNCTION analytics.segment_users()
RETURNS void AS $$
BEGIN
    UPDATE analytics.user_engagement
    SET customer_segment = CASE
        WHEN confirmed_appointments > 0 THEN 'High Value'
        WHEN total_appointments > 0 THEN 'Engaged'
        WHEN total_conversations > 5 THEN 'Interested'
        WHEN total_conversations > 0 THEN 'Browsing'
        ELSE 'New'
    END,
    engagement_score = (
        (total_conversations * 1.0) +
        (total_messages * 0.1) +
        (total_appointments * 10.0) +
        (confirmed_appointments * 20.0)
    ),
    last_updated = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily metrics update (requires pg_cron extension or external scheduler)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('update-business-metrics', '0 1 * * *', 'SELECT analytics.update_business_metrics_daily();');
-- SELECT cron.schedule('segment-users', '0 2 * * *', 'SELECT analytics.segment_users();');

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA analytics TO admin_user;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO admin_user;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA analytics TO admin_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO admin_user;