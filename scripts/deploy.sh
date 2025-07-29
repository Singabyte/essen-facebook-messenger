#!/bin/bash

# Deployment script for Facebook Messenger Bot

echo "🚀 Starting deployment..."

# Exit on error
set -e

# Variables
APP_DIR="/home/botuser/facebook-messenger-bot"
BACKUP_DIR="/home/botuser/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup current deployment
if [ -d "$APP_DIR" ]; then
    echo "📦 Backing up current deployment..."
    tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C "$APP_DIR" .
fi

# Pull latest code
echo "📥 Pulling latest code..."
cd $APP_DIR
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Run database migrations if needed
echo "🗄️ Checking database..."
node -e "require('./src/database').initDatabase()"

# Restart application
echo "🔄 Restarting application..."
pm2 restart facebook-bot || pm2 start src/index.js --name facebook-bot

# Save PM2 configuration
pm2 save

# Health check
echo "🏥 Running health check..."
sleep 5
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ $response -eq 200 ]; then
    echo "✅ Deployment successful! Bot is running."
else
    echo "❌ Health check failed. Rolling back..."
    # Rollback logic here if needed
    exit 1
fi

echo "🎉 Deployment complete!"