-- Quick fix for missing analytics views
-- This creates the most critical views that are causing errors

-- Create analytics schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create user_engagement table if missing
CREATE TABLE IF NOT EXISTS analytics.user_engagement (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE,
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

-- Create product_inquiries table if missing
CREATE TABLE IF NOT EXISTS analytics.product_inquiries (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    product_category VARCHAR(100),
    user_id INTEGER,
    conversation_id INTEGER,
    inquiry_type VARCHAR(50),
    inquiry_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    led_to_appointment BOOLEAN DEFAULT FALSE
);

-- Create conversion funnel view
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

-- Create user behavior patterns view (simplified for now)
CREATE OR REPLACE VIEW analytics.v_user_behavior_patterns AS
SELECT 
    date_trunc('hour', c.created_at) as hour_slot,
    COUNT(DISTINCT c.user_id) as unique_users,
    COUNT(c.id) as total_messages,
    AVG(LENGTH(c.message)) as avg_message_length
FROM conversations c
WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY hour_slot
ORDER BY hour_slot DESC;

-- Create product trends view
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

-- Create user engagement summary view
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

-- Initialize user engagement data if empty
INSERT INTO analytics.user_engagement (
    user_id, first_interaction, last_interaction, 
    total_conversations, total_messages, total_appointments,
    confirmed_appointments, engagement_score, customer_segment
)
SELECT 
    u.id,
    MIN(c.created_at),
    MAX(c.created_at),
    COUNT(DISTINCT DATE(c.created_at)),
    COUNT(c.id),
    COUNT(DISTINCT a.id),
    COUNT(DISTINCT CASE WHEN a.status = 'confirmed' THEN a.id END),
    0,
    'New'
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id
LEFT JOIN appointments a ON u.id = a.user_id
GROUP BY u.id
ON CONFLICT (user_id) DO NOTHING;