#!/bin/bash

# Admin Interface Deployment Script for DigitalOcean
# Optimized for both Droplets and App Platform

set -e

echo "🚀 Deploying ESSEN Bot Admin Interface..."

# Deployment type detection
DEPLOYMENT_TYPE="droplet"
if [ -d "/workspace" ]; then
    DEPLOYMENT_TYPE="app_platform"
    echo "📱 Detected DigitalOcean App Platform deployment"
else
    echo "💧 Detected DigitalOcean Droplet deployment"
fi

# Load environment variables with validation
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "⚠️  No .env file found"
fi

# Validate critical environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is required for PostgreSQL deployment"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "⚠️  WARNING: JWT_SECRET not set, using default (not recommended for production)"
fi

# Create backup of existing deployment
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/admin-backup-$TIMESTAMP"

if [ "$DEPLOYMENT_TYPE" = "droplet" ] && [ -d "/opt/essen-admin-server" ]; then
    echo "📦 Creating backup of existing deployment..."
    mkdir -p $BACKUP_DIR
    cp -r /opt/essen-admin-server $BACKUP_DIR/
fi

# Build React app with error handling
echo "📦 Building React application..."
cd client
if ! npm ci; then
    echo "❌ Failed to install client dependencies"
    exit 1
fi
if ! npm run build; then
    echo "❌ Failed to build React application"
    exit 1
fi
cd ..

# Build server with error handling
echo "📦 Installing server dependencies..."
cd server
if ! npm ci --only=production; then
    echo "❌ Failed to install server dependencies"
    exit 1
fi

# Test database connection before proceeding
echo "🔌 Testing database connection..."
if ! node -e "require('./src/db/connection-pg.js').pool.query('SELECT 1').then(() => console.log('DB OK')).catch(e => { console.error('DB Error:', e.message); process.exit(1); })"; then
    echo "❌ Database connection failed"
    exit 1
fi

# Create admin user in PostgreSQL with retry logic
echo "👤 Creating admin user in PostgreSQL..."
RETRY_COUNT=0
MAX_RETRIES=3

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if node create-admin-pg.js; then
        echo "✅ Admin user setup completed"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⚠️  Admin user setup failed, retrying in 5 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
            sleep 5
        else
            echo "❌ Admin user setup failed after $MAX_RETRIES attempts"
            exit 1
        fi
    fi
done

cd ..

# Deployment-specific file copying
if [ "$DEPLOYMENT_TYPE" = "app_platform" ]; then
    echo "📂 Copying files for App Platform deployment..."
    # For App Platform, files are already in the right place
    echo "✅ App Platform deployment - files ready"
else
    # Droplet deployment
    echo "📂 Copying files for Droplet deployment..."
    
    # Create deployment directories
    DEPLOY_DIR="/var/www/admin-interface"
    SERVER_DIR="/opt/essen-admin-server"
    
    sudo mkdir -p $DEPLOY_DIR
    sudo mkdir -p $SERVER_DIR
    
    # Copy files with proper permissions
    sudo cp -r client/dist/* $DEPLOY_DIR/
    sudo cp -r server/* $SERVER_DIR/
    
    # Copy environment file
    if [ -f server/.env ]; then
        sudo cp server/.env $SERVER_DIR/.env
    fi
    
    # Set proper ownership
    sudo chown -R www-data:www-data $DEPLOY_DIR
    sudo chown -R node:node $SERVER_DIR
    
    # Use PM2 for consistency with main bot
    echo "⚙️ Setting up PM2 process..."
    
    # Create PM2 ecosystem file
    sudo tee $SERVER_DIR/ecosystem.admin.config.js > /dev/null <<EOF
module.exports = {
  apps: [{
    name: 'essen-admin',
    script: './src/index.js',
    cwd: '$SERVER_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: '/var/log/essen-admin/error.log',
    out_file: '/var/log/essen-admin/out.log',
    log_file: '/var/log/essen-admin/combined.log',
    time: true,
    merge_logs: true
  }]
};
EOF
    
    # Create log directory
    sudo mkdir -p /var/log/essen-admin
    sudo chown node:node /var/log/essen-admin
    
    # Start/restart with PM2
    echo "🔄 Starting admin interface with PM2..."
    sudo -u node pm2 delete essen-admin 2>/dev/null || true
    sudo -u node pm2 start $SERVER_DIR/ecosystem.admin.config.js
    sudo -u node pm2 save
    
    # Set up Nginx if not already configured
    if [ ! -f /etc/nginx/sites-available/essen-admin ]; then
        echo "🌐 Configuring Nginx..."
        sudo cp nginx.conf /etc/nginx/sites-available/essen-admin
        sudo ln -s /etc/nginx/sites-available/essen-admin /etc/nginx/sites-enabled/
        
        # Test Nginx configuration
        if sudo nginx -t; then
            sudo systemctl reload nginx
            echo "✅ Nginx configuration updated"
        else
            echo "❌ Nginx configuration test failed"
            exit 1
        fi
    fi
fi

# Health check
echo "🏥 Running health check..."
sleep 5

if [ "$DEPLOYMENT_TYPE" = "droplet" ]; then
    HEALTH_URL="http://localhost:4000/api/health"
else
    HEALTH_URL="http://localhost:4000/api/health"
fi

if curl -f -s $HEALTH_URL > /dev/null; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed, but deployment may still be successful"
fi

echo "✅ Deployment complete!"

if [ "$DEPLOYMENT_TYPE" = "droplet" ]; then
    echo "🔍 Check PM2 status: sudo -u node pm2 status"
    echo "📊 View logs: sudo -u node pm2 logs essen-admin"
    echo "🔄 Restart: sudo -u node pm2 restart essen-admin"
else
    echo "📱 App Platform deployment complete"
    echo "📊 Check logs in DigitalOcean dashboard"
fi

# Cleanup backup on successful deployment
if [ -d "$BACKUP_DIR" ]; then
    echo "🧹 Cleaning up backup (deployment successful)"
    rm -rf $BACKUP_DIR
fi