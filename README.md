# Facebook Messenger Bot

A self-hosted Facebook Messenger bot powered by Google's Gemini AI.

## Features

- 💬 Natural conversation powered by Gemini AI
- 📊 SQLite database for conversation history
- 🔄 Quick replies for better UX
- 📈 Analytics and user tracking
- 🔐 Secure webhook verification
- 🚀 Production-ready with PM2

## Prerequisites

- Node.js 20.x or higher
- Facebook Page and Developer Account
- Google Gemini API key
- DigitalOcean droplet (or any VPS)
- Domain name (optional but recommended)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd facebook-messenger-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## Configuration

### Environment Variables

- `PAGE_ACCESS_TOKEN` - Facebook Page access token
- `VERIFY_TOKEN` - Custom token for webhook verification
- `APP_SECRET` - Facebook App secret
- `GEMINI_API_KEY` - Google Gemini API key
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `DB_PATH` - SQLite database path

### Facebook Setup

1. Create a Facebook App at https://developers.facebook.com
2. Add Messenger product
3. Generate page access token
4. Configure webhook URL: `https://your-domain.com/webhook`
5. Subscribe to messages, messaging_postbacks events

## Project Structure

```
├── src/
│   ├── index.js         # Main server file
│   ├── webhook.js       # Facebook webhook handler
│   ├── messageHandler.js # Message processing logic
│   ├── geminiClient.js  # Gemini AI integration
│   └── database.js      # Database operations
├── config/
│   └── config.js        # Configuration file
├── scripts/
│   ├── deploy.sh        # Deployment script
│   ├── monitor.sh       # Monitoring script
│   └── backup.sh        # Backup script
├── database/            # SQLite database directory
└── logs/               # Application logs
```

## Commands

### User Commands
- `/help` - Show help message
- `/clear` - Clear conversation history
- `/about` - About the bot

### Development
```bash
npm run dev    # Start with nodemon
npm start      # Start production server
```

### Deployment
```bash
chmod +x scripts/*.sh
./scripts/deploy.sh
```

### Monitoring
```bash
# Add to crontab
*/5 * * * * /path/to/scripts/monitor.sh
```

### Backup
```bash
# Add to crontab
0 2 * * * /path/to/scripts/backup.sh
```

## Production Deployment

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### PM2 Commands
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
pm2 logs facebook-bot
pm2 restart facebook-bot
```

### SSL with Let's Encrypt
```bash
sudo certbot --nginx -d your-domain.com
```

## Security

- Webhook signature verification
- Environment variables for sensitive data
- Rate limiting (planned)
- Input validation
- SQL injection prevention

## Database Schema

### Tables
- `users` - User information
- `conversations` - Message history
- `user_preferences` - User settings
- `analytics` - Event tracking

## Troubleshooting

### Webhook Verification Failed
- Check VERIFY_TOKEN matches
- Ensure SSL certificate is valid
- Verify domain is accessible

### Messages Not Received
- Check webhook subscriptions
- Verify page is subscribed to app
- Check PM2 logs: `pm2 logs facebook-bot`

### Database Errors
- Check file permissions
- Ensure database directory exists
- Run: `node -e "require('./src/database').initDatabase()"`

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

ISC

## Support

For issues and questions, please open a GitHub issue.