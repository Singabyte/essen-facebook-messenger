#!/bin/bash

# Admin Interface Deployment Script

set -e

echo "🚀 Deploying ESSEN Bot Admin Interface..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Build React app
echo "📦 Building React application..."
cd client
npm ci
npm run build
cd ..

# Build server
echo "📦 Installing server dependencies..."
cd server
npm ci --only=production
cd ..

# Create deployment directory
DEPLOY_DIR="/var/www/admin-interface"
sudo mkdir -p $DEPLOY_DIR

# Copy files
echo "📂 Copying files to deployment directory..."
sudo cp -r client/dist/* $DEPLOY_DIR/
sudo cp -r server /opt/essen-admin-server

# Set up systemd service
echo "⚙️ Setting up systemd service..."
sudo tee /etc/systemd/system/essen-admin.service > /dev/null <<EOF
[Unit]
Description=ESSEN Bot Admin Interface
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/essen-admin-server
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=4000
EnvironmentFile=/opt/essen-admin-server/.env

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
echo "🔄 Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable essen-admin
sudo systemctl restart essen-admin

# Set up Nginx if not already configured
if [ ! -f /etc/nginx/sites-available/essen-admin ]; then
    echo "🌐 Configuring Nginx..."
    sudo cp nginx.conf /etc/nginx/sites-available/essen-admin
    sudo ln -s /etc/nginx/sites-available/essen-admin /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
fi

echo "✅ Deployment complete!"
echo "🔍 Check service status: sudo systemctl status essen-admin"
echo "📊 View logs: sudo journalctl -u essen-admin -f"