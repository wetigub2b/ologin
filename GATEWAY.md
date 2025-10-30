# OAuth Login Gateway Documentation

This application now functions as a complete OAuth 2.0 / OpenID Connect (OIDC) authorization server that other applications can use for authentication.

## Architecture Overview

```
User → Client App → OAuth Gateway → Google/Apple → OAuth Gateway → Client App
         ↓           (authorize)       (auth)       (token)         ↓
         └────────────────────────────────────────────────────────┘
                         (access_token + user data)
```

## Features

- ✅ **OAuth 2.0 Authorization Code Flow** with PKCE support
- ✅ **OpenID Connect (OIDC)** UserInfo endpoint
- ✅ **Multiple OAuth Providers**: Google & Apple Sign In
- ✅ **Token Management**: Access tokens (24h) & Refresh tokens (90d)
- ✅ **User Consent Flow**: Privacy-respecting authorization screens
- ✅ **Client Management**: Register and manage OAuth clients
- ✅ **MySQL Database**: Persistent storage for users, clients, and tokens
- ✅ **JWT Tokens**: Industry-standard JSON Web Tokens
- ✅ **Security**: PKCE, CSRF protection, secure token storage

## Setup Guide

### 1. Database Setup

Create MySQL database:

```sql
CREATE DATABASE oauth_gateway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

The schema will be automatically initialized on first run.

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required Configuration:**

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=oauth_gateway
DB_USER=root
DB_PASSWORD=your-mysql-password

# Security
SESSION_SECRET=generate-random-string-here
JWT_SECRET=generate-random-jwt-secret-here
ADMIN_API_KEY=generate-random-admin-key-here

# OAuth Providers (Google and/or Apple)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Start the Server

```bash
npm install
npm start
```

The server will:
- Connect to MySQL
- Initialize database schema
- Start on port 3000 (configurable)
- Display available endpoints

## Client Registration

### Register a New OAuth Client

Use the Admin API to register your application:

```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-admin-api-key" \
  -d '{
    "name": "My Application",
    "description": "My awesome app description",
    "redirectUris": [
      "http://localhost:4000/callback",
      "https://myapp.com/auth/callback"
    ],
    "allowedScopes": ["openid", "profile", "email"],
    "logoUrl": "https://myapp.com/logo.png",
    "websiteUrl": "https://myapp.com",
    "privacyPolicyUrl": "https://myapp.com/privacy",
    "termsOfServiceUrl": "https://myapp.com/terms"
  }'
```

**Response:**

```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "client_secret": "secret_abc123...",
  "client_name": "My Application",
  "redirect_uris": ["http://localhost:4000/callback"],
  "allowed_scopes": ["openid", "profile", "email"],
  "message": "IMPORTANT: Save the client_secret now. It will not be shown again!"
}
```

**⚠️ Save `client_secret` immediately - it will only be shown once!**

### List All Clients

```bash
curl http://localhost:3000/api/admin/clients \
  -H "X-Admin-Key: your-admin-api-key"
```

### Delete a Client

```bash
curl -X DELETE http://localhost:3000/api/admin/clients/{client_id} \
  -H "X-Admin-Key: your-admin-api-key"
```

## OAuth 2.0 Integration

### Authorization Code Flow (with PKCE)

#### Step 1: Generate PKCE Parameters

```javascript
// Generate code verifier (random string)
const codeVerifier = crypto.randomBytes(32).toString('base64url');

// Generate code challenge
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');
```

#### Step 2: Redirect User to Authorization Endpoint

```
GET https://your-gateway.com/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  scope=openid profile email&
  state=RANDOM_STATE_STRING&
  code_challenge=CODE_CHALLENGE&
  code_challenge_method=S256
```

**Parameters:**
- `response_type`: Must be `code`
- `client_id`: Your registered client ID
- `redirect_uri`: Must match registered URI
- `scope`: Space-separated scopes (openid, profile, email)
- `state`: CSRF protection token
- `code_challenge`: PKCE challenge
- `code_challenge_method`: Use `S256` (SHA-256)

#### Step 3: Handle Callback

User will be redirected back with authorization code:

```
https://your-app.com/callback?
  code=AUTHORIZATION_CODE&
  state=YOUR_STATE
```

#### Step 4: Exchange Code for Tokens

```bash
curl -X POST https://your-gateway.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE" \
  -d "redirect_uri=YOUR_REDIRECT_URI" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code_verifier=CODE_VERIFIER"
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "refresh_token_here",
  "scope": "openid profile email"
}
```

#### Step 5: Get User Info

```bash
curl https://your-gateway.com/api/userinfo \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

**Response:**

```json
{
  "sub": "123",
  "name": "John Doe",
  "email": "john@example.com",
  "picture": "https://...",
  "email_verified": true,
  "provider": "google"
}
```

### Refresh Token Flow

```bash
curl -X POST https://your-gateway.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=REFRESH_TOKEN" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

### Token Revocation

```bash
curl -X POST https://your-gateway.com/oauth/revoke \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=TOKEN_TO_REVOKE" \
  -d "token_type_hint=access_token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

### Token Introspection

```bash
curl -X POST https://your-gateway.com/oauth/introspect \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=TOKEN_TO_CHECK" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

**Response:**

```json
{
  "active": true,
  "scope": "openid profile email",
  "client_id": "your-client-id",
  "username": "user@example.com",
  "token_type": "Bearer",
  "exp": 1234567890,
  "sub": "123"
}
```

## API Endpoints

### OAuth 2.0 Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth/authorize` | GET | Authorization endpoint |
| `/oauth/authorize` | POST | Handle user consent |
| `/oauth/token` | POST | Token endpoint |
| `/oauth/revoke` | POST | Token revocation |
| `/oauth/introspect` | POST | Token introspection |

### OIDC Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/userinfo` | GET | Get user profile (requires Bearer token) |
| `/api/validate` | GET | Quick token validation |

### Client Management (Admin)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/clients` | POST | Create new client |
| `/api/admin/clients` | GET | List all clients |
| `/api/admin/clients/:id` | DELETE | Delete client |

### User Consent Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/consents` | GET | List user authorizations |
| `/api/consents/:clientId` | DELETE | Revoke authorization |

## Example Client Integration

### Node.js/Express Example

```javascript
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

const GATEWAY_URL = 'https://your-gateway.com';
const CLIENT_ID = 'your-client-id';
const CLIENT_SECRET = 'your-client-secret';
const REDIRECT_URI = 'http://localhost:4000/callback';

// Store code verifiers temporarily (use Redis in production)
const codeVerifiers = new Map();

// Login route
app.get('/login', (req, res) => {
  // Generate PKCE parameters
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');

  // Store verifier
  codeVerifiers.set(state, codeVerifier);

  // Build authorization URL
  const authUrl = new URL(`${GATEWAY_URL}/oauth/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  res.redirect(authUrl.toString());
});

// Callback route
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // Get code verifier
  const codeVerifier = codeVerifiers.get(state);
  codeVerifiers.delete(state);

  if (!codeVerifier) {
    return res.status(400).send('Invalid state');
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      `${GATEWAY_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code_verifier: codeVerifier
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get(`${GATEWAY_URL}/api/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    // Store tokens and user info in session
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;
    req.session.user = userResponse.data;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.listen(4000, () => console.log('Client app running on port 4000'));
```

## Security Best Practices

1. **Always use HTTPS** in production
2. **Use PKCE** for all clients (especially public clients)
3. **Validate redirect_uri** strictly
4. **Store client_secret** securely (environment variables, secrets manager)
5. **Implement rate limiting** on token endpoints
6. **Rotate JWT_SECRET** and SESSION_SECRET regularly
7. **Monitor token usage** for anomalies
8. **Set secure cookie flags** in production
9. **Implement CSRF protection** with state parameter
10. **Use short-lived access tokens** with refresh token rotation

## Token Lifetimes

| Token Type | Lifetime | Renewable |
|------------|----------|-----------|
| Authorization Code | 10 minutes | No |
| Access Token (JWT) | 24 hours | Via refresh token |
| Refresh Token | 90 days | No (get new one) |

## Troubleshooting

### Database Connection Issues

```bash
# Test MySQL connection
mysql -h localhost -u root -p oauth_gateway

# Check if tables exist
SHOW TABLES;
```

### Token Validation Failures

- Verify JWT_SECRET matches between token creation and validation
- Check token expiration (`exp` claim)
- Ensure token hasn't been revoked

### PKCE Errors

- Verify code_verifier matches original code_challenge
- Use `S256` method (SHA-256), not `plain`
- Ensure code_challenge is base64url encoded

## Support & Documentation

- OAuth 2.0: https://oauth.net/2/
- OpenID Connect: https://openid.net/connect/
- PKCE: https://oauth.net/2/pkce/
- JWT: https://jwt.io/

## License

MIT
