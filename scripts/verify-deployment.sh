#!/bin/bash

# Deployment Verification Script for ESSEN Facebook Messenger Bot
# This script checks that all services are properly deployed and configured

echo "🔍 ESSEN Bot Deployment Verification"
echo "===================================="

# Configuration
APP_URL=${APP_URL:-"https://essen-messenger-bot-zxxtw.ondigitalocean.app"}
VERIFY_TOKEN=${VERIFY_TOKEN:-"essen_verify_token_12345"}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=$3
    local description=$4
    
    echo -n "Testing $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $response)"
        if [ ! -z "$description" ]; then
            echo "  └─ $description"
        fi
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $response)"
        return 1
    fi
}

# Test function with body check
test_endpoint_body() {
    local name=$1
    local url=$2
    local expected_text=$3
    local description=$4
    
    echo -n "Testing $name... "
    response=$(curl -s "$url")
    
    if [[ "$response" == *"$expected_text"* ]]; then
        echo -e "${GREEN}✓ PASS${NC}"
        if [ ! -z "$description" ]; then
            echo "  └─ $description"
        fi
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Response doesn't contain: $expected_text)"
        echo "  └─ Response: ${response:0:100}..."
        return 1
    fi
}

# Keep track of failures
FAILED_TESTS=0

echo ""
echo "1️⃣  Testing Bot Service"
echo "------------------------"

# Test bot health
test_endpoint "Bot Health" "$APP_URL/health" 200 "Bot service is running"
FAILED_TESTS=$((FAILED_TESTS + $?))

# Test bot root
test_endpoint_body "Bot Root" "$APP_URL/" "Facebook Messenger Bot" "Bot info endpoint working"
FAILED_TESTS=$((FAILED_TESTS + $?))

# Test webhook verification
echo -n "Testing Webhook Verification... "
webhook_url="$APP_URL/webhook?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=test123"
response=$(curl -s "$webhook_url")
if [ "$response" == "test123" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo "  └─ Webhook verification working correctly"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "  └─ Expected: test123, Got: $response"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "2️⃣  Testing Admin API"
echo "---------------------"

# Test admin API health
test_endpoint "Admin API Health" "$APP_URL/api/health" 200 "Admin API service is running"
FAILED_TESTS=$((FAILED_TESTS + $?))

# Test admin API root
test_endpoint_body "Admin API Root" "$APP_URL/api" "ESSEN Bot Admin API" "Admin API info endpoint working"
FAILED_TESTS=$((FAILED_TESTS + $?))

# Test auth endpoint exists
test_endpoint "Auth Endpoint" "$APP_URL/api/auth/login" 400 "Auth endpoint accessible (400 = missing credentials)"
FAILED_TESTS=$((FAILED_TESTS + $?))

echo ""
echo "3️⃣  Testing Admin UI"
echo "--------------------"

# Test admin UI
test_endpoint "Admin UI" "$APP_URL/" 200 "Admin UI static site is served"
FAILED_TESTS=$((FAILED_TESTS + $?))

echo ""
echo "4️⃣  Environment Checks"
echo "----------------------"

# Check if we can get app info (requires doctl)
if command -v doctl &> /dev/null; then
    echo "Checking DigitalOcean app configuration..."
    
    # Get app ID
    APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep "essen-messenger-bot" | awk '{print $1}')
    
    if [ ! -z "$APP_ID" ]; then
        echo "  └─ App ID: $APP_ID"
        
        # Check environment variables
        echo -n "  └─ Checking environment variables... "
        env_vars=$(doctl apps config get $APP_ID --format Key --no-header)
        required_vars=("PAGE_ACCESS_TOKEN" "VERIFY_TOKEN" "APP_SECRET" "GEMINI_API_KEY" "JWT_SECRET")
        missing_vars=()
        
        for var in "${required_vars[@]}"; do
            if ! echo "$env_vars" | grep -q "^$var$"; then
                missing_vars+=("$var")
            fi
        done
        
        if [ ${#missing_vars[@]} -eq 0 ]; then
            echo -e "${GREEN}✓ All required variables set${NC}"
        else
            echo -e "${RED}✗ Missing variables: ${missing_vars[*]}${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${YELLOW}⚠️  Cannot find app in doctl${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  doctl not installed - skipping app checks${NC}"
fi

echo ""
echo "5️⃣  Security Checks"
echo "-------------------"

# Test webhook with invalid token
echo -n "Testing webhook security... "
bad_webhook_url="$APP_URL/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test123"
response_code=$(curl -s -o /dev/null -w "%{http_code}" "$bad_webhook_url")
if [ "$response_code" -eq 403 ]; then
    echo -e "${GREEN}✓ PASS${NC} (Correctly rejected invalid token)"
else
    echo -e "${RED}✗ FAIL${NC} (Should return 403 for invalid token, got: $response_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test admin API requires auth
echo -n "Testing admin API security... "
response_code=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/users")
if [ "$response_code" -eq 401 ] || [ "$response_code" -eq 403 ]; then
    echo -e "${GREEN}✓ PASS${NC} (Correctly requires authentication)"
else
    echo -e "${RED}✗ FAIL${NC} (Should require auth, got: $response_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "📊 Summary"
echo "----------"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Deployment verified.${NC}"
else
    echo -e "${RED}❌ $FAILED_TESTS test(s) failed. Please check the deployment.${NC}"
    echo ""
    echo "Common issues:"
    echo "- Webhook 404: Check that /webhook route is configured in app.yaml"
    echo "- Admin login fails: Ensure JWT_SECRET matches between services"
    echo "- Missing env vars: Set them in DigitalOcean App Platform settings"
fi

echo ""
echo "📝 Next Steps:"
echo "- Test webhook: node scripts/test-webhook.js"
echo "- Create admin user: DB_PATH=/workspace/database/bot.db node admin-interface/server/create-admin-production.js"
echo "- View logs: doctl apps logs $APP_ID --type=run"

exit $FAILED_TESTS