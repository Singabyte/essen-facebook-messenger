-- Add bot control features to users table
-- This migration adds fields to control bot behavior per user

-- Add bot_enabled field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT true;

-- Add admin_takeover field to track when admin is handling the conversation
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_takeover BOOLEAN DEFAULT false;

-- Add admin_takeover_at to track when admin took over
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_takeover_at TIMESTAMP;

-- Add admin_takeover_by to track which admin took over
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_takeover_by VARCHAR(255);

-- Create index for quick bot status lookups
CREATE INDEX IF NOT EXISTS idx_users_bot_enabled ON users(id, bot_enabled);
CREATE INDEX IF NOT EXISTS idx_users_admin_takeover ON users(id, admin_takeover) WHERE admin_takeover = true;

-- Add conversation metadata for admin messages
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_admin_message BOOLEAN DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS admin_id VARCHAR(255);

-- Create index for admin messages
CREATE INDEX IF NOT EXISTS idx_conversations_admin ON conversations(user_id, is_admin_message) WHERE is_admin_message = true;