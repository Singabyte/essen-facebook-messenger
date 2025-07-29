# Deployment Guide

## Auto-Deployment Setup with GitHub Actions

### Prerequisites
- GitHub account
- DigitalOcean droplet (Ubuntu 22.04)
- Domain name (optional but recommended)

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository named `essen-facebook-messenger`
3. Keep it private if you want
4. Don't initialize with README (we already have one)

### Step 2: Push Code to GitHub

```bash
# In your local project directory
git remote add origin https://github.com/YOUR_USERNAME/essen-facebook-messenger.git
git branch -M main
git push -u origin main
```

### Step 3: Server Initial Setup

SSH into your server:
```bash
ssh botuser@your-server-ip
```

Run the setup script:
```bash
# Download and run setup script
wget https://raw.githubusercontent.com/YOUR_USERNAME/essen-facebook-messenger/main/scripts/server-setup.sh
chmod +x server-setup.sh
./server-setup.sh
```

### Step 4: Configure GitHub Secrets

In your GitHub repository:
1. Go to Settings → Secrets and variables → Actions
2. Add these secrets:
   - `SERVER_HOST`: Your server IP or domain
   - `SERVER_USER`: botuser
   - `SERVER_PASSWORD`: Your botuser password

For better security, use SSH key instead:
1. Generate SSH key on server:
   ```bash
   ssh-keygen -t ed25519 -C "github-deploy"
   # Press Enter for all prompts
   cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/id_ed25519
   ```
2. Copy the private key and add as `SERVER_SSH_KEY` secret

### Step 5: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/facebook-bot
```

Add:
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

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/facebook-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

### Step 7: Environment Variables

On your server, edit the .env file:
```bash
nano ~/essen-facebook-messenger/.env
```

Add your actual credentials:
```env
PAGE_ACCESS_TOKEN=your_actual_token
VERIFY_TOKEN=your_verify_token
APP_SECRET=your_app_secret
GEMINI_API_KEY=your_gemini_key
```

### Step 8: Test Auto-Deployment

1. Make a small change locally (like updating README)
2. Commit and push:
   ```bash
   git add .
   git commit -m "Test auto-deployment"
   git push
   ```
3. Check GitHub Actions tab in your repository
4. Monitor deployment progress

## Deployment Workflow

### How It Works

1. **Push to main branch** → Triggers GitHub Action
2. **GitHub Action runs**:
   - Runs tests (if any)
   - Checks for hardcoded secrets
   - SSHs into your server
   - Pulls latest code
   - Installs dependencies
   - Restarts PM2
   - Verifies deployment

### Manual Deployment

If needed, you can trigger deployment manually:
1. Go to Actions tab in GitHub
2. Select "Secure Deploy to DigitalOcean"
3. Click "Run workflow"

### Rollback

If deployment fails:
```bash
# On server
cd ~/
mv essen-facebook-messenger essen-facebook-messenger-broken
mv backup-[latest-timestamp] essen-facebook-messenger
cd essen-facebook-messenger
pm2 restart facebook-bot
```

## Best Practices

### 1. Never Commit Secrets
- Use `.env` files
- Add `.env` to `.gitignore`
- Use GitHub Secrets for deployment

### 2. Test Before Deploying
- Run locally first
- Use pull requests
- Enable branch protection

### 3. Monitor Deployments
- Watch GitHub Actions logs
- Check PM2 logs after deployment
- Set up alerts for failures

### 4. Backup Strategy
- Automatic backups before deployment
- Keep last 3 versions
- Regular database backups

## Troubleshooting

### GitHub Action Fails

1. **Authentication failed**:
   - Check SERVER_USER and SERVER_PASSWORD secrets
   - Verify SSH access works manually

2. **Health check fails**:
   - Check PM2 logs: `pm2 logs facebook-bot`
   - Verify .env file has correct values
   - Check Nginx is running

3. **Permission denied**:
   - Ensure botuser owns the app directory
   - Check file permissions

### Server Issues

1. **Bot not starting**:
   ```bash
   pm2 status
   pm2 logs facebook-bot --lines 100
   ```

2. **Database errors**:
   ```bash
   cd ~/essen-facebook-messenger
   node -e "require('./src/database').initDatabase()"
   ```

3. **Port already in use**:
   ```bash
   sudo lsof -i :3000
   pm2 delete all
   pm2 start ecosystem.config.js
   ```

## Security Considerations

1. **Use SSH keys** instead of passwords when possible
2. **Restrict GitHub Action** to only main branch
3. **Use branch protection** rules
4. **Regular security updates**:
   ```bash
   sudo apt update && sudo apt upgrade
   npm audit
   ```

5. **Monitor access logs**:
   ```bash
   sudo tail -f /var/log/auth.log
   ```

## Monitoring

### Set up monitoring dashboard:
```bash
# Install netdata (optional)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

### PM2 monitoring:
```bash
pm2 monit
pm2 web
```

### Custom alerts:
Edit `scripts/monitor.sh` to add Slack/Email notifications

## Cost Optimization

1. **Use GitHub Actions free tier** (2,000 minutes/month)
2. **Cache npm dependencies** in workflows
3. **Only deploy on main branch**
4. **Use smallest suitable droplet size**

---

For more help, check the [README.md](README.md) or open an issue on GitHub.