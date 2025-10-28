# Simple Deployment Guide

## Quick Setup (3 Steps)

### 1. Install & Configure

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env  # Edit with your OAuth credentials
```

### 2. Start the App

**Option A: Using npm (simple)**
```bash
npm start
```

**Option B: Using PM2 (recommended for production)**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the app
pm2 start server.js --name oauth-login

# Save PM2 configuration
pm2 save

# Start PM2 on system boot
pm2 startup
# Follow the command it shows
```

### 3. Setup Nginx Proxy

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/ologin

# Edit server_name if needed
sudo nano /etc/nginx/sites-available/ologin

# Enable the site
sudo ln -s /etc/nginx/sites-available/ologin /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

Done! Visit `http://your-server-ip` or `http://your-domain.com`

---

## PM2 Quick Commands

```bash
pm2 status                  # Check app status
pm2 logs oauth-login        # View logs
pm2 restart oauth-login     # Restart app
pm2 stop oauth-login        # Stop app
pm2 delete oauth-login      # Remove from PM2
```

---

## Troubleshooting

### App not accessible
```bash
# Check if app is running
pm2 status
# or
curl http://localhost:3000

# Check nginx status
sudo systemctl status nginx

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Port 3000 already in use
```bash
# Find what's using port 3000
sudo lsof -i :3000

# Change port in .env file
nano .env
# Set: PORT=3001
```

### OAuth callback errors
- Update callback URLs in Google/Apple console to match your domain
- Make sure .env has correct GOOGLE_CALLBACK_URL and APPLE_CALLBACK_URL

---

## Production Tips

1. **Use HTTPS** - Get free SSL certificate with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

2. **Set NODE_ENV to production** in .env:
   ```env
   NODE_ENV=production
   ```

3. **Update OAuth callback URLs** to use https://your-domain.com

4. **Enable firewall**:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```
