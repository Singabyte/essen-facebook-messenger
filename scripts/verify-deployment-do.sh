#!/bin/bash

# DigitalOcean Deployment Verification Script
# Verifies that the Facebook Messenger Bot is properly deployed and configured

set -e

echo "🔍 DigitalOcean Deployment Verification"
echo "======================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK") echo -e "${GREEN}✅ $message${NC}" ;;
        "WARN") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "ERROR") echo -e "${RED}❌ $message${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️  $message${NC}" ;;
    esac
}

# Check if running as correct user
current_user=$(whoami)
print_status "INFO" "Running as user: $current_user"

# 1. Check system requirements
echo ""
echo "🖥️  System Requirements Check"
echo "----------------------------"

# Check Node.js
if command -v node &> /dev/null; then
    node_version=$(node --version)
    print_status "OK" "Node.js $node_version installed"
else
    print_status "ERROR" "Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    npm_version=$(npm --version)
    print_status "OK" "npm $npm_version installed"
else
    print_status "ERROR" "npm not found"
    exit 1
fi

# Check PM2
if command -v pm2 &> /dev/null; then
    pm2_version=$(pm2 --version)
    print_status "OK" "PM2 $pm2_version installed"
else
    print_status "ERROR" "PM2 not found"
    exit 1
fi

# Check PostgreSQL client
if command -v psql &> /dev/null; then
    psql_version=$(psql --version | cut -d' ' -f3)
    print_status "OK" "PostgreSQL client $psql_version installed"
else
    print_status "WARN" "PostgreSQL client not found (may not be needed)"
fi

# 2. Check environment variables
echo ""
echo "🔧 Environment Variables Check"
echo "-----------------------------"

if [ -f ".env" ]; then
    print_status "OK" ".env file found"
    
    # Load environment variables
    source .env
    
    # Check critical variables
    [ ! -z "$PAGE_ACCESS_TOKEN" ] && print_status "OK" "PAGE_ACCESS_TOKEN is set" || print_status "ERROR" "PAGE_ACCESS_TOKEN is missing"
    [ ! -z "$VERIFY_TOKEN" ] && print_status "OK" "VERIFY_TOKEN is set" || print_status "ERROR" "VERIFY_TOKEN is missing"
    [ ! -z "$APP_SECRET" ] && print_status "OK" "APP_SECRET is set" || print_status "ERROR" "APP_SECRET is missing"
    [ ! -z "$GEMINI_API_KEY" ] && print_status "OK" "GEMINI_API_KEY is set" || print_status "ERROR" "GEMINI_API_KEY is missing"
    [ ! -z "$DATABASE_URL" ] && print_status "OK" "DATABASE_URL is set (PostgreSQL)" || print_status "WARN" "DATABASE_URL not set (using SQLite)"
    [ ! -z "$JWT_SECRET" ] && print_status "OK" "JWT_SECRET is set" || print_status "WARN" "JWT_SECRET not set (admin interface may not work)"
    
else
    print_status "ERROR" ".env file not found"
    exit 1
fi

# 3. Check database connectivity
echo ""
echo "🗄️  Database Connectivity Check"
echo "------------------------------"

if [ ! -z "$DATABASE_URL" ]; then
    print_status "INFO" "Testing PostgreSQL connection..."
    
    # Test database connection with Node.js
    node -e "
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        pool.query('SELECT NOW() as current_time', (err, res) => {
            if (err) {
                console.error('❌ Database connection failed:', err.message);
                process.exit(1);
            } else {
                console.log('✅ Database connection successful');
                console.log('📅 Server time:', res.rows[0].current_time);
                pool.end();
            }
        });
    " && print_status "OK" "PostgreSQL connection successful" || print_status "ERROR" "PostgreSQL connection failed"
else
    print_status "INFO" "Using SQLite database"
    if [ -f "./database/bot.db" ]; then
        print_status "OK" "SQLite database file exists"
    else
        print_status "WARN" "SQLite database file not found (will be created on first run)"
    fi
fi

# 4. Check PM2 processes
echo ""
echo "⚙️  PM2 Process Check"
echo "-------------------"

pm2_status=$(pm2 list | grep -c "online" || echo "0")
if [ "$pm2_status" -gt 0 ]; then
    print_status "OK" "$pm2_status PM2 process(es) running"
    pm2 list
else
    print_status "WARN" "No PM2 processes running"
fi

# Check specific processes
if pm2 list | grep -q "facebook-bot"; then
    bot_status=$(pm2 list | grep "facebook-bot" | awk '{print $10}')
    if [ "$bot_status" = "online" ]; then
        print_status "OK" "facebook-bot process is online"
    else
        print_status "ERROR" "facebook-bot process is $bot_status"
    fi
else
    print_status "WARN" "facebook-bot process not found"
fi

if pm2 list | grep -q "essen-admin"; then
    admin_status=$(pm2 list | grep "essen-admin" | awk '{print $10}')
    if [ "$admin_status" = "online" ]; then
        print_status "OK" "essen-admin process is online"
    else
        print_status "ERROR" "essen-admin process is $admin_status"
    fi
else
    print_status "WARN" "essen-admin process not found"
fi

# 5. Check network connectivity
echo ""
echo "🌐 Network Connectivity Check"
echo "----------------------------"

# Check if ports are listening
if netstat -tulpn 2>/dev/null | grep -q ":3000.*LISTEN" || ss -tulpn 2>/dev/null | grep -q ":3000.*LISTEN"; then
    print_status "OK" "Port 3000 is listening (main bot)"
else
    print_status "ERROR" "Port 3000 is not listening"
fi

if netstat -tulpn 2>/dev/null | grep -q ":4000.*LISTEN" || ss -tulpn 2>/dev/null | grep -q ":4000.*LISTEN"; then
    print_status "OK" "Port 4000 is listening (admin interface)"
else
    print_status "WARN" "Port 4000 is not listening (admin interface may not be running)"
fi

# 6. Check HTTP endpoints
echo ""
echo "🔌 HTTP Endpoint Check"
echo "---------------------"

# Test main bot health endpoint
if curl -f -s http://localhost:3000/health > /dev/null; then
    print_status "OK" "Main bot health endpoint responding"
else
    print_status "ERROR" "Main bot health endpoint not responding"
fi

# Test webhook endpoint (should return method not allowed for GET)
webhook_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/webhook)
if [ "$webhook_response" = "405" ] || [ "$webhook_response" = "200" ]; then
    print_status "OK" "Webhook endpoint responding (HTTP $webhook_response)"
else
    print_status "WARN" "Webhook endpoint returned HTTP $webhook_response"
fi

# Test admin interface (if running)
if curl -f -s http://localhost:4000/api/health > /dev/null 2>&1; then
    print_status "OK" "Admin interface health endpoint responding"
else
    print_status "WARN" "Admin interface health endpoint not responding"
fi

# 7. Check log files
echo ""
echo "📝 Log Files Check"
echo "-----------------"

if [ -d "./logs" ]; then
    print_status "OK" "Log directory exists"
    log_count=$(find ./logs -name "*.log" | wc -l)
    print_status "INFO" "$log_count log files found"
    
    # Check for recent log entries
    if [ -f "./logs/combined.log" ]; then
        recent_logs=$(tail -n 10 ./logs/combined.log | wc -l)
        if [ "$recent_logs" -gt 0 ]; then
            print_status "OK" "Recent log entries found"
            print_status "INFO" "Last log entry:"
            tail -n 1 ./logs/combined.log
        else
            print_status "WARN" "No recent log entries"
        fi
    fi
else
    print_status "WARN" "Log directory not found"
fi

# 8. Check Nginx (if available)
echo ""
echo "🌐 Nginx Check"
echo "-------------"

if command -v nginx &> /dev/null; then
    if systemctl is-active --quiet nginx; then
        print_status "OK" "Nginx is running"
        
        # Check if our site is enabled
        if [ -f "/etc/nginx/sites-enabled/facebook-bot" ]; then
            print_status "OK" "Facebook bot site is enabled in Nginx"
        else
            print_status "WARN" "Facebook bot site not enabled in Nginx"
        fi
        
        if [ -f "/etc/nginx/sites-enabled/essen-admin" ]; then
            print_status "OK" "Admin interface site is enabled in Nginx"
        else
            print_status "WARN" "Admin interface site not enabled in Nginx"
        fi
        
        # Test Nginx configuration
        if nginx -t 2>/dev/null; then
            print_status "OK" "Nginx configuration is valid"
        else
            print_status "ERROR" "Nginx configuration has errors"
        fi
    else
        print_status "WARN" "Nginx is not running"
    fi
else
    print_status "WARN" "Nginx not found"
fi

# 9. Check SSL certificates (if domain is configured)
echo ""
echo "🔒 SSL Certificate Check"
echo "-----------------------"

# This would need to be customized based on actual domain
if [ ! -z "$DOMAIN" ]; then
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        cert_expiry=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem | cut -d= -f2)
        print_status "OK" "SSL certificate found, expires: $cert_expiry"
    else
        print_status "WARN" "SSL certificate not found for domain $DOMAIN"
    fi
else
    print_status "INFO" "DOMAIN not set, skipping SSL check"
fi

# 10. Check admin user
echo ""
echo "👤 Admin User Check"
echo "------------------"

if [ ! -z "$DATABASE_URL" ]; then
    admin_count=$(node -e "
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        pool.query('SELECT COUNT(*) as count FROM admin_users', (err, res) => {
            if (err) {
                console.log('0');
            } else {
                console.log(res.rows[0].count);
            }
            pool.end();
        });
    " 2>/dev/null || echo "0")
    
    if [ "$admin_count" -gt 0 ]; then
        print_status "OK" "$admin_count admin user(s) configured"
    else
        print_status "WARN" "No admin users found - run create-admin-pg.js"
    fi
else
    print_status "INFO" "SQLite mode - admin users not checked"
fi

# Summary
echo ""
echo "📊 Verification Summary"
echo "======================"

# Count checks
total_checks=0
passed_checks=0
warnings=0
errors=0

# This is a simplified summary - in a real implementation, you'd track each check
print_status "INFO" "Deployment verification completed"
print_status "INFO" "Check the output above for any issues that need attention"

echo ""
echo "🔧 Quick Commands:"
echo "- View PM2 processes: pm2 list"
echo "- View logs: pm2 logs"
echo "- Restart bot: pm2 restart facebook-bot"
echo "- Restart admin: pm2 restart essen-admin"
echo "- Check Nginx: systemctl status nginx"
echo "- View recent logs: tail -f ./logs/combined.log"