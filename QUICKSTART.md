# OAuth Gateway Quick Start Guide

Get your OAuth gateway running in 5 minutes!

## Prerequisites

- Node.js 14+ installed
- MySQL server running
- Basic understanding of OAuth 2.0

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# Database - Setup wizard will create user if needed!
DB_HOST=localhost
DB_USER=oauth_user        # Will be created automatically
DB_PASSWORD=secure-password-here  # Used for new user
DB_NAME=oauth_gateway

# Required Security Keys
JWT_SECRET=your-random-secret-here
SESSION_SECRET=your-random-secret-here
ADMIN_API_KEY=your-random-admin-key-here

# OAuth Providers (at least one)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

**Note:** You can use any username for `DB_USER` - the setup wizard will create it automatically!

## Step 3: Run Setup Wizard

```bash
npm run setup
```

This will **automatically** (using `sudo mysql`):
- ✅ Connect to MySQL server
- ✅ Create MySQL user (if `DB_USER` doesn't exist)
- ✅ Grant necessary privileges
- ✅ Create `oauth_gateway` database (if needed)
- ✅ Create all tables and schema
- ✅ Generate your first OAuth client

**What happens:**
1. Tries to connect with `DB_USER` from .env
2. If fails → Uses `sudo mysql` to create user with `DB_PASSWORD`
3. Creates database and tables
4. Generates OAuth client

**No passwords to enter!** The script uses `sudo mysql` which works without password on Ubuntu/Debian.

**Save the client credentials!** You'll need them for your app.

> **Requirements:**
> - MySQL server running: `sudo systemctl start mysql`
> - Your user has sudo privileges
> - That's it! No MySQL root password needed

## Step 4: Start Server

```bash
npm start
```

Server will run on http://localhost:3000

## Step 5: Test the Gateway

### Option A: Manual Test

1. Visit: `http://localhost:3000`
2. Click "Sign in with Google"
3. Authorize the app
4. You're logged in!

### Option B: Integration Test

Use the client credentials from setup:

```javascript
// Your app's login endpoint
const authUrl = `http://localhost:3000/oauth/authorize?` +
  `response_type=code&` +
  `client_id=YOUR_CLIENT_ID&` +
  `redirect_uri=YOUR_REDIRECT_URI&` +
  `scope=openid+profile+email&` +
  `state=random-state-string&` +
  `code_challenge=YOUR_PKCE_CHALLENGE&` +
  `code_challenge_method=S256`;

// Redirect user to authUrl
```

See [GATEWAY.md](./GATEWAY.md) for complete integration guide.

## Common Issues

### MySQL Connection Failed

**Error:** "MySQL connection failed! ECONNREFUSED"

```bash
# Start MySQL
sudo systemctl start mysql

# Verify it's running
sudo systemctl status mysql

# Test connection manually
mysql -h localhost -u root -p
```

### User Already Exists Error

**Error:** "User 'oauth_user' already exists"

The setup wizard handles this! It will:
1. Detect existing user
2. Grant necessary privileges
3. Continue with database setup

If you want to use a different user, change `DB_USER` in `.env`

### Cannot Use sudo mysql

**Error:** "Cannot use sudo mysql!"

This means either:
1. MySQL is not running: `sudo systemctl start mysql`
2. You don't have sudo privileges
3. MySQL is not installed

**Solution:** Make sure you can run:
```bash
sudo mysql -e "SELECT 1"
```

If that works, the setup should work too!

### "Client not found" Error

Make sure you ran `npm run setup` and saved the client credentials.

### PKCE Verification Failed

Ensure you're using base64url encoding (not base64) for code_challenge.

## Next Steps

1. **Read the docs**: [GATEWAY.md](./GATEWAY.md)
2. **Secure your setup**: Change all default secrets
3. **Add OAuth providers**: Configure Google/Apple in `.env`
4. **Create more clients**: Use Admin API
5. **Deploy**: See [DEPLOY-SIMPLE.md](./DEPLOY-SIMPLE.md)

## Useful Commands

```bash
# Start development server with auto-reload
npm run dev

# View all clients
curl http://localhost:3000/api/admin/clients \
  -H "X-Admin-Key: your-admin-key"

# Create new client
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-admin-key" \
  -d '{"name":"My App","redirectUris":["http://localhost:4000/callback"]}'
```

## Architecture

```
┌─────────────┐
│   Your App  │
└──────┬──────┘
       │ 1. Redirect to /oauth/authorize
       ↓
┌─────────────────────────┐
│   OAuth Gateway         │
│   (This Server)         │
├─────────────────────────┤
│ • /oauth/authorize      │
│ • /oauth/token          │
│ • /api/userinfo         │
└──────┬──────────────────┘
       │ 2. User signs in with Google/Apple
       ↓
┌─────────────┐
│ Google/Apple│
└──────┬──────┘
       │ 3. Return to gateway
       ↓
       │ 4. Redirect to your app with code
       ↓
┌─────────────┐
│   Your App  │
│ 5. Exchange code for token
│ 6. Use token to get user info
└─────────────┘
```

## Security Checklist

- [ ] Changed JWT_SECRET from default
- [ ] Changed SESSION_SECRET from default
- [ ] Changed ADMIN_API_KEY from default
- [ ] Using HTTPS in production
- [ ] Database has strong password
- [ ] Registered redirect URIs are exact matches
- [ ] Using PKCE for all clients

## Need Help?

- **Documentation**: [GATEWAY.md](./GATEWAY.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **OAuth 2.0 Spec**: https://oauth.net/2/
- **OpenID Connect**: https://openid.net/connect/

Happy coding! 🚀
