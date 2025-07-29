#!/bin/bash

# Backup script for Facebook Messenger Bot

# Configuration
BACKUP_DIR="/home/botuser/backups"
APP_DIR="/home/botuser/facebook-messenger-bot"
DB_PATH="$APP_DIR/database/bot.db"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🔄 Starting backup process..."

# Backup database
if [ -f "$DB_PATH" ]; then
    echo "📊 Backing up database..."
    sqlite3 $DB_PATH ".backup '$BACKUP_DIR/db_backup_$TIMESTAMP.db'"
    
    # Compress database backup
    gzip "$BACKUP_DIR/db_backup_$TIMESTAMP.db"
    echo "✅ Database backup completed"
else
    echo "⚠️ Database not found at $DB_PATH"
fi

# Backup environment file (without sensitive data)
if [ -f "$APP_DIR/.env" ]; then
    echo "🔐 Backing up configuration..."
    # Create sanitized version without tokens
    grep -v "TOKEN\|KEY\|SECRET" "$APP_DIR/.env" > "$BACKUP_DIR/env_backup_$TIMESTAMP.txt"
fi

# Backup logs
if [ -d "$APP_DIR/logs" ]; then
    echo "📝 Backing up logs..."
    tar -czf "$BACKUP_DIR/logs_backup_$TIMESTAMP.tar.gz" -C "$APP_DIR" logs/
fi

# Clean up old backups
echo "🧹 Cleaning up old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.txt" -mtime +$RETENTION_DAYS -delete

# List current backups
echo "📦 Current backups:"
ls -lh $BACKUP_DIR | grep -E "(db_backup|logs_backup|env_backup)"

echo "✅ Backup process completed!"