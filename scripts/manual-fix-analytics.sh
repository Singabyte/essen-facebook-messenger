#!/bin/bash

# Manual script to fix analytics views in production
# Run this if the analytics views are missing

echo "This script will create the missing analytics views in the production database."
echo "You need to have the DATABASE_URL environment variable set or provide it as an argument."
echo ""

# Get database URL
if [ -n "$1" ]; then
    DATABASE_URL="$1"
elif [ -n "$DATABASE_URL" ]; then
    DATABASE_URL="$DATABASE_URL"
else
    echo "Error: No database URL provided"
    echo "Usage: $0 <database_url>"
    echo "Or set DATABASE_URL environment variable"
    exit 1
fi

echo "Connecting to database..."
echo ""

# Run the SQL script
psql "$DATABASE_URL" << 'EOF'
-- Create analytics schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create basic tables if missing
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

-- Create the missing views
CREATE OR REPLACE VIEW analytics.v_conversion_funnel AS
SELECT 
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN u.id END) as engaged_users,
    COUNT(DISTINCT CASE WHEN pi.id IS NOT NULL THEN u.id END) as product_inquiry_users,
    COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN u.id END) as appointment_users,
    COUNT(DISTINCT CASE WHEN a.status = 'confirmed' THEN u.id END) as confirmed_appointment_users,
    ROUND(COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN u.id END)::numeric / NULLIF(COUNT(DISTINCT u.id), 0) * 100, 2) as engagement_rate,
    ROUND(COUNT(DISTINCT CASE WHEN pi.id IS NOT NULL THEN u.id END)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN u.id END), 0) * 100, 2) as inquiry_rate,
    ROUND(COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN u.id END)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN pi.id IS NOT NULL THEN u.id END), 0) * 100, 2) as appointment_rate,
    ROUND(COUNT(DISTINCT CASE WHEN a.status = 'confirmed' THEN u.id END)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN u.id END), 0) * 100, 2) as confirmation_rate
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id
LEFT JOIN analytics.product_inquiries pi ON u.id = pi.user_id
LEFT JOIN appointments a ON u.id = a.user_id
WHERE u.created_at >= CURRENT_DATE - INTERVAL '30 days';

CREATE OR REPLACE VIEW analytics.v_user_engagement_summary AS
SELECT 
    COALESCE(customer_segment, 'All Users') as customer_segment,
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

CREATE OR REPLACE VIEW analytics.v_slow_queries AS
SELECT 
    'No pg_stat_statements available' as query,
    0 as calls,
    0 as total_time,
    0 as mean_time,
    0 as min_time,
    0 as max_time,
    0 as stddev_time,
    0 as rows,
    0 as avg_time_ms,
    'INFO' as performance_status;

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

-- Show what was created
\dt analytics.*
\dv analytics.*

EOF

echo ""
echo "Script completed. Check the output above for any errors."
echo "The analytics views should now be created."