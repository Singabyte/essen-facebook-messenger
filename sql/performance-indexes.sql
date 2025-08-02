-- ESSEN Facebook Messenger Bot - Performance Indexes
-- This script creates indexes to optimize query performance

-- Core table indexes for optimal performance
-- Users table
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_fb_id ON users(facebook_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(created_at) WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Conversations table - critical for message retrieval
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_created_from_user ON conversations(created_at DESC, is_from_user);
CREATE INDEX IF NOT EXISTS idx_conversations_recent ON conversations(created_at DESC) WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
CREATE INDEX IF NOT EXISTS idx_conversations_commands ON conversations(message) WHERE message LIKE '/%';
CREATE INDEX IF NOT EXISTS idx_conversations_user_recent ON conversations(user_id, created_at DESC) WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Appointments table
CREATE INDEX IF NOT EXISTS idx_appointments_user_status ON appointments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_created ON appointments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON appointments(status, appointment_date) WHERE status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming ON appointments(appointment_date, appointment_time) WHERE status = 'confirmed' AND appointment_date >= CURRENT_DATE;

-- User preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(preference_key);

-- Analytics tables indexes
-- Performance metrics
CREATE INDEX IF NOT EXISTS idx_perf_metrics_type_time ON analytics.performance_metrics(metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_recent ON analytics.performance_metrics(created_at DESC) WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours';

-- Query performance
CREATE INDEX IF NOT EXISTS idx_query_perf_hash ON analytics.query_performance(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_perf_slow ON analytics.query_performance(execution_time_ms DESC) WHERE execution_time_ms > 1000;
CREATE INDEX IF NOT EXISTS idx_query_perf_recent ON analytics.query_performance(created_at DESC) WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Conversation analytics
CREATE INDEX IF NOT EXISTS idx_conv_analytics_user_time ON analytics.conversation_analytics(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_conv_analytics_outcome ON analytics.conversation_analytics(outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_analytics_score ON analytics.conversation_analytics(conversation_score DESC) WHERE conversation_score IS NOT NULL;

-- Business metrics daily
CREATE INDEX IF NOT EXISTS idx_business_metrics_date ON analytics.business_metrics_daily(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_business_metrics_recent ON analytics.business_metrics_daily(metric_date DESC) WHERE metric_date >= CURRENT_DATE - INTERVAL '90 days';

-- Product inquiries
CREATE INDEX IF NOT EXISTS idx_product_inq_name_time ON analytics.product_inquiries(product_name, inquiry_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_product_inq_category ON analytics.product_inquiries(product_category, inquiry_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_product_inq_user ON analytics.product_inquiries(user_id, inquiry_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_product_inq_appointment ON analytics.product_inquiries(led_to_appointment, inquiry_timestamp DESC) WHERE led_to_appointment = true;

-- User engagement
CREATE INDEX IF NOT EXISTS idx_user_engagement_segment ON analytics.user_engagement(customer_segment);
CREATE INDEX IF NOT EXISTS idx_user_engagement_score ON analytics.user_engagement(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_engagement_active ON analytics.user_engagement(last_interaction DESC) WHERE last_interaction >= CURRENT_DATE - INTERVAL '30 days';

-- Alert history
CREATE INDEX IF NOT EXISTS idx_alert_history_unresolved ON analytics.alert_history(alert_type, created_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON analytics.alert_history(severity, created_at DESC);

-- Partial indexes for common queries
-- Active conversations in last hour
CREATE INDEX IF NOT EXISTS idx_conversations_last_hour ON conversations(user_id, created_at DESC) 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour';

-- Today's appointments
CREATE INDEX IF NOT EXISTS idx_appointments_today ON appointments(appointment_date, appointment_time, status) 
WHERE appointment_date = CURRENT_DATE;

-- High-value users
CREATE INDEX IF NOT EXISTS idx_user_engagement_high_value ON analytics.user_engagement(user_id, engagement_score DESC) 
WHERE customer_segment = 'High Value';

-- Recent product inquiries
CREATE INDEX IF NOT EXISTS idx_product_inquiries_recent ON analytics.product_inquiries(product_name, inquiry_timestamp DESC) 
WHERE inquiry_timestamp >= CURRENT_DATE - INTERVAL '7 days';

-- Composite indexes for complex queries
-- User conversation history
CREATE INDEX IF NOT EXISTS idx_user_conversation_history ON conversations(user_id, created_at DESC, is_from_user)
INCLUDE (message);

-- Appointment analytics
CREATE INDEX IF NOT EXISTS idx_appointment_analytics ON appointments(user_id, appointment_date, status)
INCLUDE (appointment_time, service_type);

-- Message pattern analysis
CREATE INDEX IF NOT EXISTS idx_message_patterns ON conversations(user_id, created_at DESC)
WHERE message LIKE '%price%' OR message LIKE '%cost%' OR message LIKE '%promotion%';

-- Function-based indexes
-- Hour of day analysis
CREATE INDEX IF NOT EXISTS idx_conversations_hour ON conversations(EXTRACT(hour FROM created_at), created_at DESC);

-- Day of week analysis
CREATE INDEX IF NOT EXISTS idx_appointments_dow ON appointments(EXTRACT(dow FROM appointment_date), status);

-- Message length analysis
CREATE INDEX IF NOT EXISTS idx_message_length ON conversations(LENGTH(message), created_at DESC);

-- GIN indexes for JSONB columns
-- User preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_data_gin ON user_preferences USING gin(preference_data);

-- Business metrics popular products
CREATE INDEX IF NOT EXISTS idx_business_metrics_products_gin ON analytics.business_metrics_daily USING gin(popular_products);

-- User engagement favorite products
CREATE INDEX IF NOT EXISTS idx_user_engagement_favorites_gin ON analytics.user_engagement USING gin(favorite_products);

-- Alert metadata
CREATE INDEX IF NOT EXISTS idx_alert_metadata_gin ON analytics.alert_history USING gin(metadata);

-- Text search indexes (if using full-text search)
-- CREATE INDEX IF NOT EXISTS idx_conversations_fts ON conversations USING gin(to_tsvector('english', message));
-- CREATE INDEX IF NOT EXISTS idx_product_inquiries_fts ON analytics.product_inquiries USING gin(to_tsvector('english', product_name));

-- Maintenance commands to run periodically
-- ANALYZE; -- Update statistics
-- REINDEX DATABASE essen_bot; -- Rebuild indexes if needed
-- VACUUM ANALYZE; -- Clean up and update statistics

-- Query to check index usage
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
*/

-- Query to find missing indexes
/*
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    most_common_vals
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    AND n_distinct > 100
    AND attname NOT IN (
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = (schemaname||'.'||tablename)::regclass
    )
ORDER BY n_distinct DESC;
*/