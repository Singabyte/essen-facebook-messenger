# DigitalOcean Deployment Guide

## Quick Start

1. **Set Environment Variables in DigitalOcean App Platform:**
   ```
   # Facebook Bot Service
   PAGE_ACCESS_TOKEN=EAAJxaX96PV8BPKQJCfQOiXOSBrw9Ia4ZAVOdZASssGE63eoe7f3NwWru61ChaYZCAPI74PuvgSsfiZBlP2qRcZBkw0WYjWGBScqP8qbsbbkumLrZAWuF8lsuQ0ZB2BAM4jIgMxglSZACDdKEjYI3wlIkjDe8X64929zwTrrYcwxalfAqDv676alKsd2QeEEVzsuz8jlNtzwZD
   VERIFY_TOKEN=essen_verify_token_12345
   APP_SECRET=93a7f726cc57861625a7e3db4d138594
   GEMINI_API_KEY=AIzaSyDjovnKGN-17inztoZjxAZKE4pR20rZBgc
   JWT_SECRET=xVmE8Q7F+Rd3YKZPlm9cwXQ7RHLvW8Ij6N2BaMnKt1s=
   DB_PATH=/workspace/database/bot.db
   PORT=3000
   NODE_ENV=production
   
   # Admin API Service
   JWT_SECRET=xVmE8Q7F+Rd3YKZPlm9cwXQ7RHLvW8Ij6N2BaMnKt1s=
   PORT=4000
   NODE_ENV=production
   DB_PATH=/workspace/database/bot.db
   FRONTEND_URL=${APP_URL}
   
   # Admin UI Static Site
   VITE_API_URL=${APP_URL}/api
   ```

2. **Deploy to DigitalOcean:**
   ```bash
   git add .
   git commit -m "Deploy Facebook Messenger bot with admin interface"
   git push origin main
   ```

3. **Verify Deployment:**
   ```bash
   ./scripts/verify-deployment.sh
   ```

4. **Test Webhook:**
   ```bash
   WEBHOOK_URL=https://essen-messenger-bot-zxxtw.ondigitalocean.app/webhook node scripts/test-webhook.js
   ```

5. **Create Admin User:**
   ```bash
   # SSH into DigitalOcean console or run locally with production DB path
   DB_PATH=/workspace/database/bot.db node admin-interface/server/create-admin-production.js
   ```

6. **Access Admin Interface:**
   - URL: https://essen-messenger-bot-zxxtw.ondigitalocean.app/
   - Username: admin
   - Password: hello123 (or what you set)

## Important Notes

- JWT_SECRET must be the same across all services
- DB_PATH in production is `/workspace/database/bot.db`
- The webhook URL for Facebook is: `https://essen-messenger-bot-zxxtw.ondigitalocean.app/webhook`
- All sensitive tokens should be set as SECRET type in DigitalOcean

## Troubleshooting

See `debug.md` for detailed troubleshooting steps.