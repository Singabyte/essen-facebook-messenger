#!/bin/bash

# Fix Chat Interface Issues - Deployment Script
# This script applies fixes for the admin chat interface issues

echo "========================================="
echo "ESSEN Bot - Fix Chat Interface Issues"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# Step 1: Apply database migration
echo ""
echo "Step 1: Applying database migration..."
echo "----------------------------------------"

if [ -f "../sql/add_admin_message_columns.sql" ]; then
    print_status "Migration file found"
    
    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        print_warning "DATABASE_URL not set. Please run the migration manually:"
        echo "  psql \$DATABASE_URL < sql/add_admin_message_columns.sql"
    else
        echo "Applying migration to PostgreSQL..."
        psql $DATABASE_URL < ../sql/add_admin_message_columns.sql
        if [ $? -eq 0 ]; then
            print_status "Database migration applied successfully"
        else
            print_error "Failed to apply database migration"
            exit 1
        fi
    fi
else
    print_error "Migration file not found at sql/add_admin_message_columns.sql"
    exit 1
fi

# Step 2: Build admin interface client
echo ""
echo "Step 2: Building admin interface client..."
echo "----------------------------------------"

cd ../admin-interface/client

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_warning "Installing client dependencies..."
    npm install
fi

# Build the client
print_status "Building production client..."
npm run build

if [ $? -eq 0 ]; then
    print_status "Client built successfully"
else
    print_error "Failed to build client"
    exit 1
fi

# Step 3: Restart admin server
echo ""
echo "Step 3: Preparing admin server..."
echo "----------------------------------------"

cd ../server

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_warning "Installing server dependencies..."
    npm install
fi

print_status "Server dependencies ready"

# Step 4: Deploy to DigitalOcean (if doctl is available)
echo ""
echo "Step 4: Deployment Instructions"
echo "----------------------------------------"

# Check if we're on DigitalOcean or local
if command -v doctl &> /dev/null; then
    print_status "DigitalOcean CLI detected"
    echo ""
    echo "To deploy to DigitalOcean App Platform:"
    echo "  1. Commit and push changes to GitHub:"
    echo "     git add -A"
    echo "     git commit -m 'Fix chat interface issues'"
    echo "     git push origin main"
    echo ""
    echo "  2. Trigger deployment:"
    echo "     doctl apps create-deployment <APP-ID>"
    echo ""
else
    print_warning "DigitalOcean CLI not found"
    echo ""
    echo "Manual deployment steps:"
    echo "  1. Commit and push changes to GitHub:"
    echo "     git add -A"
    echo "     git commit -m 'Fix chat interface issues'"
    echo "     git push origin main"
    echo ""
    echo "  2. Go to DigitalOcean App Platform dashboard"
    echo "  3. Click 'Deploy' to trigger a new deployment"
    echo ""
fi

# Step 5: Verification steps
echo "Step 5: Post-Deployment Verification"
echo "----------------------------------------"
echo ""
echo "After deployment, verify the fixes:"
echo ""
echo "1. Check database migration:"
echo "   - Run: psql \$DATABASE_URL -c \"\\d conversations\""
echo "   - Verify columns: is_from_user, is_admin_message, admin_id"
echo ""
echo "2. Test chat interface:"
echo "   - Go to: https://essen-messenger-bot-zxxtw.ondigitalocean.app/admin/users"
echo "   - Click on a user and open chat"
echo "   - Verify conversations load properly"
echo "   - Send a test message and verify it appears"
echo ""
echo "3. Monitor WebSocket connection:"
echo "   - Open browser console (F12)"
echo "   - Check for 'Socket connected' message"
echo "   - Verify no WebSocket errors"
echo ""
echo "4. Check real-time updates:"
echo "   - Have someone send a message to the bot"
echo "   - Verify it appears in real-time in the chat interface"
echo ""

print_status "Fix preparation completed!"
echo ""
echo "========================================="
echo "Next Steps:"
echo "1. Review and commit the changes"
echo "2. Push to GitHub to trigger deployment"
echo "3. Run database migration on production"
echo "4. Verify fixes are working"
echo "========================================="