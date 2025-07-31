#!/bin/bash

# DigitalOcean Droplet Setup Script for ESSEN Facebook Messenger Bot
# This script prepares a fresh Ubuntu droplet for production deployment

set -e

echo "🌊 DigitalOcean Droplet Setup for ESSEN Facebook Bot"
echo "=================================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
echo "🛠️ Installing essential packages..."
apt install -y curl wget git nginx ufw fail2ban htop unzip

# Install Node.js 18.x (LTS)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify Node.js installation
node_version=$(node --version)
npm_version=$(npm --version)
echo "✅ Node.js $node_version installed"
echo "✅ npm $npm_version installed"

# Install PostgreSQL client tools
echo "🗄️ Installing PostgreSQL client..."
apt install -y postgresql-client

# Install PM2 globally
echo "⚙️ Installing PM2..."
npm install -g pm2

# Create user for bot application
echo "👤 Creating bot user..."
if ! id "botuser" &>/dev/null; then
    useradd -m -s /bin/bash botuser
    usermod -aG sudo botuser
    echo "✅ Bot user created"
else
    echo "ℹ️ Bot user already exists"
fi

# Create user for node applications
echo "👤 Setting up node user..."
if ! id "node" &>/dev/null; then
    useradd -m -s /bin/bash node
    echo "✅ Node user created"
else
    echo "ℹ️ Node user already exists"
fi

# Set up directories
echo "📁 Creating application directories..."
mkdir -p /home/botuser/facebook-messenger-bot
mkdir -p /home/botuser/backups
mkdir -p /var/log/facebook-bot
mkdir -p /var/log/essen-admin
mkdir -p /var/www/admin-interface

# Set proper ownership
chown -R botuser:botuser /home/botuser
chown -R node:node /var/log/essen-admin
chown -R www-data:www-data /var/www/admin-interface
chown -R botuser:botuser /var/log/facebook-bot

# Configure UFW firewall
echo "🔥 Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
# Allow webhook port (3000) only from specific IPs if needed
# ufw allow from 31.13.64.0/19 to any port 3000  # Facebook IP range
ufw allow 3000/tcp  # For now, allow from anywhere - restrict later
ufw --force enable

# Configure fail2ban
echo "🛡️ Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Set up SSL with Certbot (Let's Encrypt)
echo "🔒 Installing Certbot for SSL..."
apt install -y certbot python3-certbot-nginx

# Configure Nginx security
echo "🌐 Configuring Nginx security..."
cat > /etc/nginx/snippets/ssl-params.conf << 'EOF'
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_dhparam /etc/nginx/dhparam.pem;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
ssl_ecdh_curve secp384r1;
ssl_session_timeout 10m;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
EOF

# Generate DH parameters (this takes a while)
echo "🔐 Generating Diffie-Hellman parameters (this may take several minutes)..."
if [ ! -f /etc/nginx/dhparam.pem ]; then
    openssl dhparam -out /etc/nginx/dhparam.pem 2048
fi

# Create a basic Nginx configuration for the bot
echo "🌐 Creating basic Nginx configuration..."
cat > /etc/nginx/sites-available/facebook-bot << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    # Facebook webhook
    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Rate limiting
        limit_req zone=webhook burst=10 nodelay;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }

    # Block all other traffic
    location / {
        return 404;
    }
}
EOF

# Set up rate limiting for webhook
cat > /etc/nginx/conf.d/rate-limit.conf << 'EOF'
# Rate limiting for Facebook webhooks
limit_req_zone $binary_remote_addr zone=webhook:10m rate=30r/m;
limit_req_status 429;
EOF

# Enable the site (but don't start it yet - needs domain configuration)
# ln -sf /etc/nginx/sites-available/facebook-bot /etc/nginx/sites-enabled/
echo "ℹ️ Nginx configuration created but not enabled yet"
echo "   Update server_name in /etc/nginx/sites-available/facebook-bot with your domain"
echo "   Then run: ln -sf /etc/nginx/sites-available/facebook-bot /etc/nginx/sites-enabled/"

# Set up log rotation
echo "📝 Configuring log rotation..."
cat > /etc/logrotate.d/facebook-bot << 'EOF'
/var/log/facebook-bot/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 botuser botuser
    postrotate
        /usr/bin/pm2 reloadLogs
    endscript
}
EOF

cat > /etc/logrotate.d/essen-admin << 'EOF'
/var/log/essen-admin/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 node node
    postrotate
        /usr/bin/pm2 reloadLogs
    endscript
}
EOF

# Set up PM2 to start on boot
echo "⚙️ Configuring PM2 startup..."
sudo -u botuser pm2 startup systemd -u botuser --hp /home/botuser
# Note: The above command will output a command to run - you'll need to run it manually

# Create PM2 log directories
mkdir -p /home/botuser/.pm2/logs
chown -R botuser:botuser /home/botuser/.pm2

# Set up health monitoring script
echo "🏥 Creating health monitoring script..."
cat > /usr/local/bin/bot-health-check.sh << 'EOF'
#!/bin/bash

# Health check script for Facebook Bot
WEBHOOK_URL="http://localhost:3000/health"
ADMIN_URL="http://localhost:4000/api/health"
LOG_FILE="/var/log/bot-health.log"

# Function to log with timestamp
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOG_FILE
}

# Check main bot
if curl -f -s $WEBHOOK_URL > /dev/null; then
    log_message "✅ Main bot is healthy"
else
    log_message "❌ Main bot health check failed - attempting restart"
    sudo -u botuser pm2 restart facebook-bot
fi

# Check admin interface
if curl -f -s $ADMIN_URL > /dev/null; then
    log_message "✅ Admin interface is healthy"
else
    log_message "❌ Admin interface health check failed - attempting restart"
    sudo -u node pm2 restart essen-admin
fi
EOF

chmod +x /usr/local/bin/bot-health-check.sh

# Set up cron job for health checks (every 5 minutes)
echo "⏰ Setting up health check cron job..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/bot-health-check.sh") | crontab -

# Set up swap if not exists (recommended for small droplets)
echo "💾 Setting up swap space..."
if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✅ 1GB swap space created"
else
    echo "ℹ️ Swap already exists"
fi

# Optimize system settings for Node.js
echo "⚡ Optimizing system settings..."
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65536
* hard nofile 65536
EOF

# Set up environment template
echo "📝 Creating environment template..."
cat > /home/botuser/facebook-messenger-bot/.env.template << 'EOF'
# Facebook Configuration
PAGE_ACCESS_TOKEN=your_page_access_token_here
VERIFY_TOKEN=essen_verify_token_12345
APP_SECRET=your_app_secret_here

# Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=production

# PostgreSQL Database (DigitalOcean Managed Database)
DATABASE_URL=postgresql://username:password@hostname:port/database?sslmode=require

# JWT Secret for Admin Interface
JWT_SECRET=generate-a-secure-random-string-here
EOF

chown botuser:botuser /home/botuser/facebook-messenger-bot/.env.template

echo ""
echo "🎉 DigitalOcean Droplet Setup Complete!"
echo "======================================"
echo ""
echo "📋 Next Steps:"
echo "1. 🏷️  Set up your domain DNS to point to this droplet"
echo "2. 🔧 Copy .env.template to .env and configure your environment variables"
echo "3. 🗄️  Create DigitalOcean Managed PostgreSQL database"
echo "4. 📥 Clone your repository to /home/botuser/facebook-messenger-bot"
echo "5. 🚀 Run deployment script: ./scripts/deploy.sh"
echo "6. 🔒 Set up SSL: certbot --nginx -d your-domain.com"
echo "7. 🌐 Enable Nginx site: ln -sf /etc/nginx/sites-available/facebook-bot /etc/nginx/sites-enabled/"
echo ""
echo "🔧 Important Files:"
echo "- Nginx config: /etc/nginx/sites-available/facebook-bot"
echo "- Environment template: /home/botuser/facebook-messenger-bot/.env.template"
echo "- Health check logs: /var/log/bot-health.log"
echo ""
echo "📊 Monitoring Commands:"
echo "- pm2 status"
echo "- pm2 logs"
echo "- tail -f /var/log/bot-health.log"
echo "- systemctl status nginx"
echo ""
echo "💡 Remember to:"
echo "- Update server_name in Nginx configs with your actual domain"
echo "- Generate a secure JWT_SECRET for the admin interface"
echo "- Configure your DigitalOcean managed database"
echo "- Set up proper backup strategies"