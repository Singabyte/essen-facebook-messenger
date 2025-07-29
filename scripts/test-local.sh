#!/bin/bash

# Local testing script for Facebook Messenger Bot

echo "🧪 Testing Facebook Messenger Bot Locally"
echo "========================================="

# Check if server is running
check_server() {
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
    if [ $response -eq 200 ]; then
        return 0
    fi
    return 1
}

# Start server if not running
if ! check_server; then
    echo "🚀 Starting server..."
    npm start &
    SERVER_PID=$!
    sleep 5
    
    if ! check_server; then
        echo "❌ Failed to start server"
        exit 1
    fi
fi

echo "✅ Server is running"

# Test webhook verification
echo ""
echo "📍 Testing webhook verification..."
VERIFY_TOKEN=$(grep VERIFY_TOKEN .env | cut -d'=' -f2)
response=$(curl -s "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=test_challenge")
if [ "$response" = "test_challenge" ]; then
    echo "✅ Webhook verification passed"
else
    echo "❌ Webhook verification failed"
fi

# Test health endpoint
echo ""
echo "🏥 Testing health endpoint..."
health=$(curl -s http://localhost:3000/health)
echo "Response: $health"

# Test root endpoint
echo ""
echo "🌐 Testing root endpoint..."
root=$(curl -s http://localhost:3000/)
echo "Response: $root"

# Show logs location
echo ""
echo "📝 Logs can be found in ./logs/"
echo ""
echo "🔍 To test with Facebook:"
echo "1. Use ngrok: ngrok http 3000"
echo "2. Configure webhook URL in Facebook App settings"
echo "3. Send a message to your Facebook Page"
echo ""

# Cleanup if we started the server
if [ ! -z "$SERVER_PID" ]; then
    echo "Press Ctrl+C to stop the server..."
    wait $SERVER_PID
fi