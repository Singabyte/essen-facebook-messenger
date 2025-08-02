#!/bin/bash

# ESSEN Bot Post-Deployment Script
# This script runs after deployment to ensure everything is properly initialized

echo "=== ESSEN Bot Post-Deployment Script ==="
echo "Starting at $(date)"

# Set error handling
set -e

# Check if we're in production
if [ "$NODE_ENV" = "production" ]; then
    echo "Running in production mode"
    
    # Initialize database schema if needed
    echo "Checking database schema..."
    if [ -n "$DATABASE_URL" ]; then
        node scripts/init-database.js || {
            echo "Warning: Database initialization had some errors"
            echo "Trying quick fix for analytics views..."
            
            # Try to apply the quick fix
            psql "$DATABASE_URL" < scripts/fix-analytics-views.sql || {
                echo "Warning: Could not apply analytics views fix"
            }
        }
    else
        echo "Warning: DATABASE_URL not set, skipping database initialization"
    fi
    
    # Create admin user if it doesn't exist
    echo "Checking admin user..."
    curl -X POST http://localhost:4000/api/debug/init-admin || {
        echo "Note: Admin user might already exist or admin API not ready"
    }
    
    echo "Post-deployment tasks completed"
else
    echo "Not in production mode, skipping post-deployment tasks"
fi

echo "=== Post-Deployment Script Completed at $(date) ==="