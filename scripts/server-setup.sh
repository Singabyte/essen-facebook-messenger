#!/bin/bash

# Server setup script for auto-deployment
# Run this once on your DigitalOcean droplet

echo "🚀 Setting up server for auto-deployment"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please run as botuser, not root${NC}"
   exit 1
fi

# Set variables
REPO_URL="https://github.com/yourusername/essen-facebook-messenger.git"
APP_DIR="$HOME/essen-facebook-messenger"

echo -e "${YELLOW}Setting up deployment environment...${NC}"

# Install required packages if not already installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Clone repository if not exists
if [ ! -d "$APP_DIR" ]; then
    echo -e "${YELLOW}Cloning repository...${NC}"
    git clone $REPO_URL $APP_DIR
else
    echo -e "${GREEN}Repository already exists${NC}"
fi

cd $APP_DIR

# Set up environment file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${RED}Please edit .env file with your credentials!${NC}"
    echo "Run: nano $APP_DIR/.env"
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install --production

# Set up PM2
echo -e "${YELLOW}Setting up PM2...${NC}"
pm2 start ecosystem.config.js
pm2 save
pm2 startup | grep sudo | bash

# Set up log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Create backup directory
mkdir -p $HOME/backups

# Set up cron jobs
echo -e "${YELLOW}Setting up cron jobs...${NC}"
(crontab -l 2>/dev/null; echo "*/5 * * * * $APP_DIR/scripts/monitor.sh") | crontab -
(crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/scripts/backup.sh") | crontab -

echo -e "${GREEN}✅ Server setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env file: nano $APP_DIR/.env"
echo "2. Set up Nginx and SSL certificate"
echo "3. Configure GitHub secrets in your repository"
echo "4. Push to main branch to trigger deployment"