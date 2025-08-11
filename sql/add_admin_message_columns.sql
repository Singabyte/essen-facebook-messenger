-- Migration: Add admin message tracking columns to conversations table
-- Date: 2025-01-11
-- Purpose: Enable proper tracking of message direction and admin messages in chat interface

-- Add is_from_user column to track message direction
-- true = message from user, false = message from bot/admin
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS is_from_user BOOLEAN DEFAULT true;

-- Add is_admin_message column to identify admin-sent messages
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS is_admin_message BOOLEAN DEFAULT false;

-- Add admin_id column to track which admin sent the message
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS admin_id VARCHAR(255);

-- Create index for faster queries on admin messages
CREATE INDEX IF NOT EXISTS idx_conversations_admin_messages 
ON conversations(user_id, is_admin_message) 
WHERE is_admin_message = true;

-- Update existing records to set proper defaults
-- All existing messages are from users (since admin takeover wasn't tracked before)
UPDATE conversations 
SET is_from_user = true,
    is_admin_message = false
WHERE is_from_user IS NULL;

-- Add comment to columns for documentation
COMMENT ON COLUMN conversations.is_from_user IS 'true if message is from user, false if from bot/admin';
COMMENT ON COLUMN conversations.is_admin_message IS 'true if message was sent by admin through admin interface';
COMMENT ON COLUMN conversations.admin_id IS 'ID of admin who sent the message (if is_admin_message = true)';