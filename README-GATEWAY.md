# 🔐 OAuth Login Gateway

Transform any app into an OAuth-authenticated service using Google/Apple Sign-In as the identity provider.

## ⚡ Quick Setup (2 Steps!)

### 1. Configure & Install
```bash
npm install
cp .env.example .env
# Edit .env with your MySQL password and OAuth credentials
```

### 2. Run Setup Wizard
```bash
npm run setup
```

The wizard automatically (using `sudo mysql`):
- ✅ **Creates MySQL user** from your .env settings
- ✅ **Creates database** oauth_gateway
- ✅ **Initializes** all tables and schema
- ✅ **Generates** your first OAuth client credentials

**No passwords required!** Uses `sudo mysql` which works without password on Ubuntu/Debian.

**That's it!** Your OAuth gateway is ready! 🎉

## 🚀 Start the Gateway

```bash
npm start
```

Visit: http://localhost:3000

## 📖 What You Get

Your app is now a **complete OAuth 2.0 / OpenID Connect Authorization Server** that other applications can use for authentication.

### Key Features

- ✅ **OAuth 2.0 Server** - Full authorization code flow with PKCE
- ✅ **OpenID Connect** - Standard OIDC UserInfo endpoint
- ✅ **Multi-Provider Auth** - Google & Apple Sign In
- ✅ **JWT Tokens** - Industry-standard access tokens (24h) & refresh tokens (90d)
- ✅ **Client Management** - Register unlimited OAuth client apps
- ✅ **User Consent** - Privacy-respecting authorization screens
- ✅ **MySQL Storage** - Persistent users, tokens, and clients
- ✅ **Security Built-in** - PKCE, CSRF protection, secure storage

## 🔌 How Other Apps Use Your Gateway

```javascript
// 1. Redirect user to your gateway
window.location = `https://your-gateway.com/oauth/authorize?` +
  `client_id=YOUR_CLIENT_ID&` +
  `redirect_uri=YOUR_CALLBACK&` +
  `response_type=code&` +
  `scope=openid+profile+email`;

// 2. User logs in with Google/Apple
// 3. User approves access
// 4. Redirected back to your app with code

// 5. Exchange code for access token
const response = await fetch('https://your-gateway.com/oauth/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    redirect_uri: 'YOUR_CALLBACK'
  })
});

const { access_token } = await response.json();

// 6. Get user info
const user = await fetch('https://your-gateway.com/api/userinfo', {
  headers: { Authorization: `Bearer ${access_token}` }
});
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[QUICKSTART.md](QUICKSTART.md)** | Get running in 5 minutes |
| **[GATEWAY.md](GATEWAY.md)** | Complete API documentation & integration guide |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System design and architecture |

## 🔐 OAuth Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/oauth/authorize` | GET | Start OAuth flow (authorization request) |
| `/oauth/token` | POST | Exchange code for access token |
| `/oauth/revoke` | POST | Revoke access/refresh token |
| `/oauth/introspect` | POST | Validate token (check if active) |
| `/api/userinfo` | GET | Get user profile (OIDC standard) |
| `/api/validate` | GET | Quick token validation |

## 🛠️ Admin API

Register and manage OAuth client applications:

```bash
# Create new client
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-admin-key" \
  -d '{
    "name": "My App",
    "redirectUris": ["http://localhost:4000/callback"]
  }'

# List all clients
curl http://localhost:3000/api/admin/clients \
  -H "X-Admin-Key: your-admin-key"

# Delete client
curl -X DELETE http://localhost:3000/api/admin/clients/CLIENT_ID \
  -H "X-Admin-Key: your-admin-key"
```

## 🔒 Environment Variables

Required in `.env`:

```env
# Database (MySQL)
DB_HOST=localhost
DB_NAME=oauth_gateway
DB_USER=root
DB_PASSWORD=your-mysql-password

# Security (generate random values!)
JWT_SECRET=your-random-jwt-secret
SESSION_SECRET=your-random-session-secret
ADMIN_API_KEY=your-random-admin-key

# OAuth Providers (at least one)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Optional: Apple Sign In
APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY_PATH=./AuthKey_XXX.p8
```

## 🎯 Use Cases

- **Microservices Authentication** - Single sign-on across multiple services
- **SaaS Applications** - Centralized user management
- **Mobile App Backend** - Secure token-based auth
- **API Gateway** - Protect APIs with OAuth tokens
- **Multi-tenant Platforms** - Isolated authentication per tenant
- **Internal Tools** - Company-wide authentication service

## 🏗️ Architecture

```
┌──────────────┐
│  Your Apps   │ (Web, Mobile, Desktop)
└──────┬───────┘
       │ OAuth 2.0 Flow
       ↓
┌─────────────────────────┐
│  OAuth Gateway          │ ← This Server
│  (Authorization Server) │
├─────────────────────────┤
│ • User Authentication   │
│ • Token Issuance        │
│ • Client Management     │
│ • Consent Management    │
└──────┬──────────────────┘
       │ Federated Auth
       ↓
┌─────────────────┐
│ Google / Apple  │ (Identity Providers)
└─────────────────┘
```

## ⏱️ Token Lifetimes

| Token Type | Lifetime | Can Refresh? |
|------------|----------|-------------|
| Authorization Code | 10 minutes | No |
| Access Token (JWT) | 24 hours | Yes (via refresh token) |
| Refresh Token | 90 days | No (get new one after use) |

## 🔧 Management Commands

```bash
# Start server
npm start

# Development with auto-reload
npm run dev

# Run setup wizard
npm run setup

# Production with PM2
npm run pm2:start
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

## 🚨 Common Issues

### Setup Fails to Create Database

**Solution:** Use MySQL root user or grant permissions:
```sql
GRANT ALL PRIVILEGES ON oauth_gateway.* TO 'your_user'@'localhost';
GRANT CREATE ON *.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### Token Validation Fails

- Check `JWT_SECRET` is the same in all environments
- Verify token hasn't expired (check `exp` claim)
- Ensure token hasn't been revoked

### PKCE Errors

- Use `S256` method (SHA-256), not `plain`
- Encode as base64url (not standard base64)
- Verify code_verifier matches original code_challenge

## 🔐 Security Best Practices

1. ✅ **Use HTTPS** in production (required for OAuth)
2. ✅ **Enable PKCE** for all clients (especially public/mobile apps)
3. ✅ **Rotate secrets** regularly (JWT_SECRET, SESSION_SECRET)
4. ✅ **Validate redirect URIs** strictly (exact match)
5. ✅ **Use strong database passwords**
6. ✅ **Set secure cookie flags** in production
7. ✅ **Implement rate limiting** on token endpoints
8. ✅ **Monitor token usage** for anomalies
9. ✅ **Store client_secret securely** (environment variables/secrets manager)
10. ✅ **Enable MySQL SSL** in production

## 📊 Database Schema

7 tables for complete OAuth implementation:

- **users** - Federated user identities (Google/Apple)
- **oauth_clients** - Registered OAuth applications
- **authorization_codes** - Short-lived auth codes (10min)
- **access_tokens** - JWT access tokens (24h)
- **refresh_tokens** - Long-lived refresh tokens (90d)
- **user_consents** - User authorization records
- Automatic cleanup of expired tokens

## 🤝 Support & Resources

- **OAuth 2.0 Spec**: https://oauth.net/2/
- **OpenID Connect**: https://openid.net/connect/
- **PKCE**: https://oauth.net/2/pkce/
- **JWT**: https://jwt.io/

## 📝 License

MIT

---

**Built with:** Node.js • Express • Passport • MySQL • JWT

**Ready to authenticate the world!** 🌍🔐
