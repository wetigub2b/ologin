# OAuth Login Demo - Google & Apple

A simple web application demonstrating OAuth 2.0 authentication with Google and Apple Sign In using Node.js, Express, and Passport.js.

## Features

- ✅ Google OAuth 2.0 authentication
- ✅ Apple Sign In integration
- ✅ Secure session management
- ✅ User profile display
- ✅ Modern, responsive UI
- ✅ Easy configuration

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Cloud Platform account (for Google OAuth)
- Apple Developer account (for Apple Sign In)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your OAuth credentials (see configuration sections below).

### 3. Run the Application

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Configuration

### Google OAuth Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google+ API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application"
   - Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
   - For production, add your production URL

4. **Configure Environment Variables**
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   ```

### Apple Sign In Setup

1. **Register an App ID**
   - Go to [Apple Developer Portal](https://developer.apple.com/)
   - Navigate to "Certificates, Identifiers & Profiles"
   - Create a new App ID or select existing one
   - Enable "Sign In with Apple" capability

2. **Create a Service ID**
   - In the same portal, go to "Identifiers"
   - Click "+" and select "Services IDs"
   - Register a Service ID (e.g., `com.yourcompany.yourapp.service`)
   - Enable "Sign In with Apple"
   - Configure domains and return URLs:
     - Domains: `localhost` (for development)
     - Return URLs: `http://localhost:3000/auth/apple/callback`

3. **Create a Private Key**
   - Go to "Keys" section
   - Click "+" to create a new key
   - Enable "Sign In with Apple"
   - Download the `.p8` key file
   - Save it in your project directory
   - Note the Key ID shown

4. **Get Team ID**
   - Find your Team ID in the top-right corner of the Apple Developer Portal
   - Or navigate to "Membership" section

5. **Configure Environment Variables**
   ```env
   APPLE_CLIENT_ID=com.yourcompany.yourapp.service
   APPLE_TEAM_ID=XXXXXXXXXX
   APPLE_KEY_ID=YYYYYYYYYY
   APPLE_PRIVATE_KEY_PATH=./AuthKey_YYYYYYYYYY.p8
   APPLE_CALLBACK_URL=http://localhost:3000/auth/apple/callback
   ```

### Session Configuration

```env
SESSION_SECRET=generate-a-random-secure-string-here
```

For production, use a strong random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Project Structure

```
oauth-login-demo/
├── server.js              # Express server and OAuth configuration
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (create from .env.example)
├── .env.example           # Example environment configuration
├── views/
│   ├── index.ejs         # Home page with login buttons
│   └── profile.ejs       # User profile page
└── public/
    └── css/
        └── style.css     # Stylesheet
```

## API Endpoints

- `GET /` - Home page with login options
- `GET /profile` - User profile page (protected)
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - Google OAuth callback
- `POST /auth/apple` - Initiate Apple Sign In flow
- `POST /auth/apple/callback` - Apple Sign In callback
- `GET /logout` - Logout user
- `GET /health` - Check OAuth configuration status

## Testing OAuth Providers

### Check Configuration Status

Visit `http://localhost:3000/health` to verify which OAuth providers are properly configured.

### Testing Google OAuth

1. Click "Continue with Google" button
2. Select a Google account
3. Grant permissions
4. You'll be redirected to the profile page

### Testing Apple Sign In

1. Click "Continue with Apple" button
2. Sign in with your Apple ID
3. Choose whether to share your email
4. You'll be redirected to the profile page

## Production Deployment

### Environment Variables

Update your `.env` file with production URLs:

```env
# Update callback URLs to your production domain
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
APPLE_CALLBACK_URL=https://yourdomain.com/auth/apple/callback

# Enable secure cookies
NODE_ENV=production
```

### OAuth Provider Updates

**Google:**
- Add production domain to authorized JavaScript origins
- Add production callback URL to authorized redirect URIs

**Apple:**
- Add production domain to allowed domains
- Add production callback URL to return URLs
- Update Service ID configuration

### Security Considerations

1. **Use HTTPS in production** - OAuth requires secure connections
2. **Strong session secret** - Generate a cryptographically secure random string
3. **Environment variables** - Never commit `.env` or private keys to version control
4. **CORS configuration** - Configure appropriate CORS policies
5. **Rate limiting** - Implement rate limiting for authentication endpoints
6. **Cookie security** - Ensure `secure` flag is enabled for cookies in production

### Automated Deployment

The project includes a deployment script that automates the deployment process.

#### Using the Deploy Script

1. **Configure WEB_ROOT in .env:**
   ```env
   WEB_ROOT=/var/www/html/ologin
   ```

2. **Run the deployment:**
   ```bash
   npm run deploy
   # or directly
   ./deploy.sh
   ```

#### What the Deploy Script Does

- ✓ Installs dependencies
- ✓ Runs build/preparation steps
- ✓ Copies application files to `WEB_ROOT`
- ✓ Excludes development files (node_modules, .git, etc.)
- ✓ Installs production-only dependencies at destination
- ✓ Sets proper file permissions
- ✓ Handles .env and .p8 private key files securely

#### Manual Deployment Steps

If you prefer manual deployment:

```bash
# 1. Build the application
npm run build

# 2. Copy files to server
rsync -av --exclude 'node_modules' \
         --exclude '.git' \
         --exclude '.env' \
         ./ user@server:/var/www/html/ologin/

# 3. SSH to server and install dependencies
ssh user@server
cd /var/www/html/ologin
npm install --production

# 4. Copy .env and configure for production
cp .env.example .env
nano .env

# 5. Start the application
npm start
```

#### Using PM2 for Production

PM2 is recommended for production deployments:

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
cd /var/www/html/ologin
pm2 start server.js --name oauth-login

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Useful PM2 commands
pm2 status              # Check status
pm2 logs oauth-login    # View logs
pm2 restart oauth-login # Restart app
pm2 stop oauth-login    # Stop app
```

Or use the npm scripts:

```bash
npm run pm2:start    # Start with PM2
npm run pm2:restart  # Restart
npm run pm2:stop     # Stop
npm run pm2:logs     # View logs
```

#### Reverse Proxy Configuration

**Nginx Configuration Example:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Apache Configuration Example:**

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    Redirect permanent / https://yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName yourdomain.com

    SSLEngine on
    SSLCertificateFile /path/to/ssl/certificate.crt
    SSLCertificateKeyFile /path/to/ssl/private.key

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

## Troubleshooting

### Google OAuth Issues

- **Error: redirect_uri_mismatch**
  - Verify redirect URI in Google Console matches your `.env` configuration
  - Ensure you've added both development and production URLs

- **Error: invalid_client**
  - Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
  - Verify credentials haven't been revoked

### Apple Sign In Issues

- **Error: invalid_client**
  - Verify Service ID matches `APPLE_CLIENT_ID`
  - Check that Team ID and Key ID are correct

- **Private key issues**
  - Ensure `.p8` file path is correct in `APPLE_PRIVATE_KEY_PATH`
  - Verify file has proper read permissions
  - Check that key hasn't been revoked in Apple Developer Portal

- **Redirect issues**
  - Verify return URL in Apple Developer Portal matches callback URL
  - For localhost testing, ensure you've properly configured domains

### General Issues

- **Session not persisting**
  - Check that `SESSION_SECRET` is set
  - Verify cookies are enabled in browser

- **Authentication loop**
  - Clear browser cookies and sessions
  - Restart the server
  - Check for correct callback URL configuration

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server when files change.

### Adding More OAuth Providers

The application uses Passport.js, which supports many OAuth providers:

1. Install the appropriate Passport strategy (e.g., `passport-facebook`, `passport-github`)
2. Add configuration to `server.js`
3. Update the UI in `views/index.ejs`

## Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Passport.js Documentation](http://www.passportjs.org/)
- [Express.js Documentation](https://expressjs.com/)

## License

MIT License - feel free to use this demo for learning and development purposes.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review OAuth provider documentation
- Verify environment configuration with `/health` endpoint
