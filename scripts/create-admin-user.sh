#!/bin/bash

# PostgreSQL Admin User Creation Helper Script
# This script runs the PostgreSQL admin user creation script
# Usage: ./scripts/create-admin-user.sh

set -e

echo "🔧 ESSEN Bot - PostgreSQL Admin User Creation"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "admin-interface/server/create-admin-pg.js" ]; then
    echo "❌ Error: Must be run from the project root directory"
    echo "Current directory: $(pwd)"
    echo "Expected file: admin-interface/server/create-admin-pg.js"
    exit 1
fi

# Load environment variables from root .env if it exists
if [ -f .env ]; then
    echo "📄 Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Load environment variables from admin server .env if it exists
if [ -f admin-interface/server/.env ]; then
    echo "📄 Loading admin server environment variables..."
    export $(cat admin-interface/server/.env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL in one of these files:"
    echo "  - .env (project root)"
    echo "  - admin-interface/server/.env"
    echo ""
    echo "Example:"
    echo "DATABASE_URL=postgresql://username:password@host:port/database"
    exit 1
fi

# Run the admin user creation script
echo "🚀 Running PostgreSQL admin user creation script..."
cd admin-interface/server
node create-admin-pg.js

echo ""
echo "✅ Admin user creation script completed!"
echo "📝 Default credentials: admin / hello123"
echo "🔗 Access admin interface at your configured URL"