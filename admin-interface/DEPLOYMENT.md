# Admin Interface Deployment Guide

## Prerequisites

- Node.js 18+
- PM2 or systemd for process management
- Nginx for reverse proxy
- SSL certificate (Let's Encrypt recommended)
- SQLite database from main bot

## Local Development

1. **Start the backend server**:
   ```bash
   cd admin-interface/server
   npm install
   npm run dev
   ```

2. **Start the frontend**:
   ```bash
   cd admin-interface/client
   npm install
   npm run dev
   ```

3. **Access the interface**: http://localhost:5173

## Production Deployment

### Option 1: Traditional Deployment

1. **Build the frontend**:
   ```bash
   cd admin-interface/client
   npm ci
   npm run build
   ```

2. **Set up the backend**:
   ```bash
   cd admin-interface/server
   npm ci --only=production
   ```

3. **Configure environment variables**:
   ```bash
   # Create production .env file
   cp .env.example .env
   nano .env
   ```

4. **Run deployment script**:
   ```bash
   ./deploy.sh
   ```

### Option 2: Docker Deployment

1. **Build and run with Docker Compose**:
   ```bash
   cd admin-interface
   docker-compose up -d
   ```

2. **View logs**:
   ```bash
   docker-compose logs -f
   ```

### Option 3: PM2 Deployment

1. **Install PM2**:
   ```bash
   npm install -g pm2
   ```

2. **Create ecosystem file**:
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'essen-admin',
       script: './server/src/index.js',
       cwd: '/path/to/admin-interface',
       env: {
         NODE_ENV: 'production',
         PORT: 4000
       }
     }]
   }
   ```

3. **Start with PM2**:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

## Nginx Configuration

1. **Install Nginx**:
   ```bash
   sudo apt-get update
   sudo apt-get install nginx
   ```

2. **Configure SSL with Let's Encrypt**:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d admin.yourdomain.com
   ```

3. **Set up Nginx config**:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/essen-admin
   sudo ln -s /etc/nginx/sites-available/essen-admin /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## Environment Variables

Create a `.env` file in the server directory:

```env
# Server Configuration
PORT=4000
NODE_ENV=production

# Database
DB_PATH=../../database/bot.db

# Authentication
JWT_SECRET=your-very-secure-secret-key

# Frontend URL (for CORS)
FRONTEND_URL=https://admin.yourdomain.com

# Optional: Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Post-Deployment

1. **Create admin user**:
   ```bash
   curl -X POST https://admin.yourdomain.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"secure-password"}'
   ```

2. **Test the deployment**:
   - Access https://admin.yourdomain.com
   - Login with admin credentials
   - Verify all features work correctly

3. **Monitor logs**:
   ```bash
   # PM2
   pm2 logs essen-admin

   # Systemd
   sudo journalctl -u essen-admin -f

   # Docker
   docker-compose logs -f admin-interface
   ```

## Security Checklist

- [ ] Change default JWT secret
- [ ] Use strong admin passwords
- [ ] Enable HTTPS only
- [ ] Configure firewall rules
- [ ] Set up regular database backups
- [ ] Monitor access logs
- [ ] Keep dependencies updated

## Troubleshooting

### Port already in use
```bash
# Find process using port 4000
lsof -i :4000
# Kill the process
kill -9 <PID>
```

### Database connection errors
- Ensure database file path is correct
- Check file permissions
- Verify SQLite is installed

### WebSocket connection issues
- Check Nginx WebSocket configuration
- Ensure CORS is properly configured
- Verify firewall allows WebSocket connections

### Build errors
- Clear node_modules and reinstall
- Check Node.js version (requires 18+)
- Ensure all environment variables are set

## Maintenance

1. **Regular updates**:
   ```bash
   # Update dependencies
   npm update
   
   # Check for vulnerabilities
   npm audit
   ```

2. **Database backup**:
   ```bash
   # Create backup
   cp database/bot.db database/bot.db.backup-$(date +%Y%m%d)
   ```

3. **Log rotation**:
   Configure logrotate for application logs

## Performance Optimization

1. **Enable Gzip compression** in Nginx
2. **Set up CDN** for static assets
3. **Configure caching headers**
4. **Use PM2 cluster mode** for multiple instances
5. **Monitor with tools** like New Relic or DataDog

## Support

For issues or questions:
- Check application logs first
- Review error messages in browser console
- Ensure all services are running
- Verify database connectivity