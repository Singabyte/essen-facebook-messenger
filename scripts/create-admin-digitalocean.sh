#!/bin/bash

# Script to create admin user in DigitalOcean deployment
# Run this in the DigitalOcean console for the admin-api service

echo "Creating admin user for ESSEN Bot Admin Interface"
echo "================================================="

# Navigate to the correct directory
cd /workspace/admin-interface/server

# Set the database path
export DB_PATH=/workspace/database/bot.db

# Run the admin creation script
node create-admin-production.js

echo ""
echo "If successful, you should now be able to login with:"
echo "Username: admin"
echo "Password: hello123"
echo ""
echo "For security, please change the password after first login!"