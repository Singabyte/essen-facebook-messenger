# Facebook Messenger Bot Development Plan
## Self-Hosted Solution Using DigitalOcean & Gemini API

### Overview
This development plan provides a comprehensive guide to create a self-hosted Facebook Messenger bot using minimal external services, leveraging your DigitalOcean credits and Gemini API access.

### Architecture Overview
- **Server**: DigitalOcean Droplet (Ubuntu 22.04 LTS)
- **Language**: Node.js (recommended) or Python
- **Database**: SQLite (file-based, no additional service needed)
- **SSL**: Let's Encrypt (free SSL certificates)
- **Process Manager**: PM2 (for Node.js) or systemd
- **Reverse Proxy**: Nginx
- **AI Integration**: Google Gemini API

---

## Phase 1: Initial Setup & Prerequisites

### Checklist
- [ ] **Create Facebook Developer Account**
  - [ ] Go to https://developers.facebook.com
  - [ ] Sign up or log in with your Facebook account
  - [ ] Accept developer terms and conditions
  - [ ] Verify your account if required

- [ ] **Create Facebook Page**
  - [ ] Visit https://www.facebook.com/pages/create
  - [ ] Choose appropriate category for your bot
  - [ ] Add profile picture and cover photo
  - [ ] Complete page information

- [ ] **Set Up DigitalOcean Droplet**
  - [ ] Log into DigitalOcean account
  - [ ] Create new Droplet (Ubuntu 22.04 LTS)
  - [ ] Choose minimum: 1GB RAM, 25GB SSD
  - [ ] Select datacenter region closest to your users
  - [ ] Add SSH key for secure access
  - [ ] Create droplet and note the IP address

- [ ] **Configure Domain (Optional but Recommended)**
  - [ ] Purchase domain or use existing one
  - [ ] Point A record to DigitalOcean droplet IP
  - [ ] Wait for DNS propagation (5-30 minutes)

---

## Phase 2: Server Configuration

### Server Setup Checklist
- [ ] **SSH into your Droplet**
  ```bash
  ssh root@your-droplet-ip
  ```

- [ ] **Update System Packages**
  ```bash
  apt update && apt upgrade -y
  ```

- [ ] **Install Required Software**
  ```bash
  # Install Node.js 20.x
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  apt install -y nodejs
  
  # Install essential tools
  apt install -y git nginx certbot python3-certbot-nginx sqlite3
  
  # Install PM2 globally
  npm install -g pm2
  ```

- [ ] **Create Non-Root User**
  ```bash
  adduser botuser
  usermod -aG sudo botuser
  su - botuser
  ```

- [ ] **Set Up Project Directory**
  ```bash
  mkdir ~/facebook-messenger-bot
  cd ~/facebook-messenger-bot
  npm init -y
  ```

---

## Phase 3: Facebook App Configuration

### Facebook Developer Setup Checklist
- [ ] **Create Facebook App**
  - [ ] Go to https://developers.facebook.com/apps
  - [ ] Click "Create App"
  - [ ] Choose "Other" for use case
  - [ ] Select "Business" for app type
  - [ ] Fill in app name and contact email
  - [ ] Complete app creation

- [ ] **Configure Messenger Product**
  - [ ] In your app dashboard, click "Add Product"
  - [ ] Find Messenger and click "Set Up"
  - [ ] Note down your App ID and App Secret

- [ ] **Generate Page Access Token**
  - [ ] In Messenger Settings, find "Access Tokens"
  - [ ] Click "Add or Remove Pages"
  - [ ] Select your Facebook Page
  - [ ] Generate token and save it securely

- [ ] **Set Up Webhook (Temporary)**
  - [ ] You'll need your server running first
  - [ ] We'll return to this in Phase 5

---

## Phase 4: Bot Development

### Core Bot Setup Checklist

- [ ] **Create Project Structure**
  ```bash
  mkdir src config database
  touch src/index.js src/webhook.js src/messageHandler.js
  touch src/database.js src/geminiClient.js
  touch config/config.js .env .gitignore
  ```

- [ ] **Install Dependencies**
  ```bash
  npm install express body-parser dotenv sqlite3 axios @google/generative-ai
  npm install --save-dev nodemon
  ```

- [ ] **Create .env File**
  ```env
  # Facebook Configuration
  PAGE_ACCESS_TOKEN=your_page_access_token
  VERIFY_TOKEN=your_custom_verify_token
  APP_SECRET=your_app_secret
  
  # Gemini API
  GEMINI_API_KEY=your_gemini_api_key
  
  # Server Configuration
  PORT=3000
  NODE_ENV=production
  
  # Database
  DB_PATH=./database/bot.db
  ```

- [ ] **Create .gitignore**
  ```
  node_modules/
  .env
  database/*.db
  logs/
  .DS_Store
  ```

### Code Implementation Checklist

- [ ] **Main Server File (src/index.js)**
  ```javascript
  require('dotenv').config();
  const express = require('express');
  const bodyParser = require('body-parser');
  const webhook = require('./webhook');
  const { initDatabase } = require('./database');
  
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  // Initialize database
  initDatabase();
  
  // Middleware
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  // Routes
  app.use('/webhook', webhook);
  
  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
  });
  
  app.listen(PORT, () => {
    console.log(`Bot server running on port ${PORT}`);
  });
  ```

- [ ] **Database Setup (src/database.js)**
  ```javascript
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  
  const dbPath = process.env.DB_PATH || './database/bot.db';
  const db = new sqlite3.Database(dbPath);
  
  function initDatabase() {
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        profile_pic TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Conversations table
      db.run(`CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        message TEXT,
        response TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);
      
      // User preferences table
      db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        preferences JSON,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);
    });
  }
  
  module.exports = { db, initDatabase };
  ```

- [ ] **Webhook Handler (src/webhook.js)**
  ```javascript
  const express = require('express');
  const router = express.Router();
  const crypto = require('crypto');
  const messageHandler = require('./messageHandler');
  
  // Webhook verification
  router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
        console.log('Webhook verified');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    }
  });
  
  // Message handling
  router.post('/', (req, res) => {
    const body = req.body;
    
    // Verify webhook signature
    if (!verifyWebhookSignature(req)) {
      return res.sendStatus(403);
    }
    
    if (body.object === 'page') {
      body.entry.forEach(entry => {
        entry.messaging.forEach(event => {
          if (event.message) {
            messageHandler.handleMessage(event);
          }
        });
      });
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  });
  
  function verifyWebhookSignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return false;
    
    const hash = crypto
      .createHmac('sha256', process.env.APP_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    return signature === `sha256=${hash}`;
  }
  
  module.exports = router;
  ```

- [ ] **Gemini Integration (src/geminiClient.js)**
  ```javascript
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  
  async function generateResponse(prompt, context = '') {
    try {
      const fullPrompt = context ? `${context}\n\nUser: ${prompt}` : prompt;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      return 'I apologize, but I encountered an error. Please try again later.';
    }
  }
  
  module.exports = { generateResponse };
  ```

- [ ] **Message Handler (src/messageHandler.js)**
  ```javascript
  const axios = require('axios');
  const { db } = require('./database');
  const { generateResponse } = require('./geminiClient');
  
  async function handleMessage(event) {
    const senderId = event.sender.id;
    const messageText = event.message.text;
    
    // Save user if new
    await saveUser(senderId);
    
    // Generate response using Gemini
    const response = await generateResponse(messageText);
    
    // Save conversation
    await saveConversation(senderId, messageText, response);
    
    // Send response
    await sendMessage(senderId, response);
  }
  
  async function saveUser(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO users (id) VALUES (?)`,
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  
  async function saveConversation(userId, message, response) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)`,
        [userId, message, response],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  
  async function sendMessage(recipientId, messageText) {
    try {
      await axios.post(
        `https://graph.facebook.com/v17.0/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text: messageText }
        },
        {
          params: { access_token: process.env.PAGE_ACCESS_TOKEN }
        }
      );
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error);
    }
  }
  
  module.exports = { handleMessage };
  ```

---

## Phase 5: Deployment & SSL Setup

### Nginx Configuration Checklist

- [ ] **Configure Nginx**
  ```bash
  sudo nano /etc/nginx/sites-available/messenger-bot
  ```

- [ ] **Add Nginx Configuration**
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
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```

- [ ] **Enable Site**
  ```bash
  sudo ln -s /etc/nginx/sites-available/messenger-bot /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl restart nginx
  ```

- [ ] **Set Up SSL with Let's Encrypt**
  ```bash
  sudo certbot --nginx -d your-domain.com
  ```

### Process Management Checklist

- [ ] **Configure PM2**
  ```bash
  pm2 start src/index.js --name facebook-bot
  pm2 save
  pm2 startup
  ```

- [ ] **Set Up Log Rotation**
  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 10M
  pm2 set pm2-logrotate:retain 7
  ```

---

## Phase 6: Facebook Webhook Configuration

### Final Facebook Setup Checklist

- [ ] **Configure Webhook URL**
  - [ ] Go to Facebook App Dashboard
  - [ ] Navigate to Messenger > Settings
  - [ ] In Webhooks section, click "Add Callback URL"
  - [ ] Enter: `https://your-domain.com/webhook`
  - [ ] Enter your VERIFY_TOKEN from .env
  - [ ] Click "Verify and Save"

- [ ] **Subscribe to Webhook Events**
  - [ ] Click "Add Subscriptions"
  - [ ] Select: messages, messaging_postbacks, messaging_optins
  - [ ] Save subscriptions

- [ ] **Subscribe Page to App**
  - [ ] In Webhooks section, select your page
  - [ ] Click "Subscribe"

---

## Phase 7: Testing & Monitoring

### Testing Checklist

- [ ] **Local Testing**
  ```bash
  # Test webhook verification
  curl -X GET "http://localhost:3000/webhook?hub.verify_token=your_verify_token&hub.challenge=test_challenge&hub.mode=subscribe"
  
  # Test health endpoint
  curl http://localhost:3000/health
  ```

- [ ] **Production Testing**
  - [ ] Send message to your Facebook Page
  - [ ] Check PM2 logs: `pm2 logs facebook-bot`
  - [ ] Verify database entries: `sqlite3 database/bot.db "SELECT * FROM conversations;"`

### Monitoring Setup Checklist

- [ ] **Set Up Basic Monitoring**
  ```bash
  # Create monitoring script
  nano ~/monitor-bot.sh
  ```

- [ ] **Add Monitoring Script**
  ```bash
  #!/bin/bash
  response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
  if [ $response -ne 200 ]; then
      pm2 restart facebook-bot
      echo "Bot restarted at $(date)" >> /var/log/bot-restarts.log
  fi
  ```

- [ ] **Add to Crontab**
  ```bash
  crontab -e
  # Add: */5 * * * * /home/botuser/monitor-bot.sh
  ```

---

## Phase 8: Advanced Features

### Enhancement Checklist

- [ ] **Add User Context Management**
  - [ ] Implement conversation history tracking
  - [ ] Add user preference storage
  - [ ] Create context-aware responses

- [ ] **Implement Rich Responses**
  - [ ] Add quick replies
  - [ ] Implement button templates
  - [ ] Add image/video support

- [ ] **Add Analytics**
  - [ ] Track message volumes
  - [ ] Monitor response times
  - [ ] Log user engagement metrics

- [ ] **Security Enhancements**
  - [ ] Implement rate limiting
  - [ ] Add request validation
  - [ ] Set up fail2ban for SSH

### Code Examples for Enhancements

- [ ] **Quick Replies Implementation**
  ```javascript
  async function sendQuickReply(recipientId, text, quickReplies) {
    const message = {
      text: text,
      quick_replies: quickReplies.map(reply => ({
        content_type: 'text',
        title: reply.title,
        payload: reply.payload
      }))
    };
    
    await sendMessage(recipientId, message);
  }
  ```

- [ ] **Button Template**
  ```javascript
  async function sendButtonTemplate(recipientId, text, buttons) {
    const message = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text,
          buttons: buttons
        }
      }
    };
    
    await sendMessage(recipientId, message);
  }
  ```

---

## Phase 9: Maintenance & Optimization

### Maintenance Checklist

- [ ] **Regular Updates**
  - [ ] Weekly: Update system packages
  - [ ] Monthly: Review and rotate logs
  - [ ] Quarterly: Update Node.js dependencies

- [ ] **Database Maintenance**
  - [ ] Set up automated backups
  - [ ] Implement data retention policies
  - [ ] Optimize queries for performance

- [ ] **Performance Optimization**
  - [ ] Implement caching for frequent queries
  - [ ] Optimize Gemini API calls
  - [ ] Monitor response times

### Backup Script
```bash
#!/bin/bash
# Save as ~/backup-bot.sh
BACKUP_DIR="/home/botuser/backups"
mkdir -p $BACKUP_DIR
sqlite3 /home/botuser/facebook-messenger-bot/database/bot.db ".backup '$BACKUP_DIR/bot-$(date +%Y%m%d).db'"
find $BACKUP_DIR -name "bot-*.db" -mtime +30 -delete
```

---

## VS Code & Claude Code Integration

### Development Workflow

1. **Local Development**
   - Clone repository to local machine
   - Use VS Code with Claude Code for development
   - Test with ngrok for webhook testing

2. **Deployment**
   - Push changes to GitHub
   - SSH into DigitalOcean droplet
   - Pull changes and restart PM2

3. **Debugging**
   - Use VS Code Remote-SSH extension
   - Connect directly to droplet for live debugging
   - Monitor logs with PM2

### Recommended VS Code Extensions
- [ ] Remote - SSH
- [ ] SQLite Viewer
- [ ] REST Client
- [ ] GitLens
- [ ] ESLint
- [ ] Prettier

---

## Troubleshooting Guide

### Common Issues & Solutions

1. **Webhook Verification Fails**
   - Check VERIFY_TOKEN matches
   - Ensure SSL certificate is valid
   - Verify Nginx is properly configured

2. **Messages Not Received**
   - Check webhook subscriptions
   - Verify page is subscribed to app
   - Review PM2 logs for errors

3. **Database Errors**
   - Check file permissions
   - Ensure database directory exists
   - Verify SQLite is installed

4. **SSL Certificate Issues**
   - Renew with: `sudo certbot renew`
   - Check domain DNS settings
   - Verify Nginx configuration

---

## Cost Analysis

### Monthly Costs (Estimated)
- DigitalOcean Droplet: $0 (using credits)
- Domain (optional): $1-2/month
- SSL Certificate: $0 (Let's Encrypt)
- Gemini API: $0 (free tier should suffice)
- Total: $0-2/month

---

## Security Best Practices

1. **Server Security**
   - [ ] Disable root SSH login
   - [ ] Use SSH keys only
   - [ ] Configure firewall (ufw)
   - [ ] Keep system updated

2. **Application Security**
   - [ ] Validate all inputs
   - [ ] Use environment variables
   - [ ] Implement rate limiting
   - [ ] Log security events

3. **Database Security**
   - [ ] Regular backups
   - [ ] Encrypt sensitive data
   - [ ] Limit file permissions
   - [ ] Use prepared statements

---

## Next Steps

1. **Immediate Actions**
   - Complete Phase 1-3 setup
   - Get basic bot running
   - Test with simple messages

2. **Short Term (Week 1-2)**
   - Implement Gemini integration
   - Add basic conversation tracking
   - Set up monitoring

3. **Long Term (Month 1-3)**
   - Add rich message types
   - Implement analytics
   - Optimize performance
   - Add advanced features

---

## Resources

- [Facebook Messenger Platform Docs](https://developers.facebook.com/docs/messenger-platform)
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [SQLite Documentation](https://sqlite.org/docs.html)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Let's Encrypt](https://letsencrypt.org/docs/)

---

This plan provides a complete roadmap for building your self-hosted Facebook Messenger bot without requiring additional paid services beyond your existing resources.