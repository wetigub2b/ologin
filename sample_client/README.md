# OAuth Sample Client

A complete sample application demonstrating OAuth 2.0 + PKCE integration with the OAuth Gateway.

## Features

- ✅ **Complete OAuth 2.0 Flow** with PKCE
- ✅ **Authorization Code Grant** with code exchange
- ✅ **Token Management** (access & refresh tokens)
- ✅ **User Info Retrieval** from OIDC endpoint
- ✅ **Token Refresh** functionality
- ✅ **Token Revocation** on logout
- ✅ **CSRF Protection** with state parameter
- ✅ **Session Management**

## Setup Instructions

### 1. Install Dependencies

```bash
cd sample_client
npm install
```

### 2. Create OAuth Client

1. Go to admin panel: http://localhost:3000/admin
2. Login with admin password
3. Click "New Client"
4. Fill in:
   - **Name**: Sample Client App
   - **Redirect URI**: `http://localhost:4000/callback`
5. Copy the **Client ID** and **Client Secret**

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=4000
GATEWAY_URL=http://localhost:3000
CLIENT_ID=your-client-id-here
CLIENT_SECRET=your-client-secret-here
REDIRECT_URI=http://localhost:4000/callback
SESSION_SECRET=change-this-in-production
```

### 4. Start the Application

```bash
npm start
```

Visit: **http://localhost:4000**

## How It Works

### OAuth 2.0 Flow

```
1. User visits http://localhost:4000
   ↓
2. Clicks "Login with OAuth Gateway"
   ↓
3. Redirected to: http://localhost:3000/oauth/authorize
   - With PKCE code_challenge
   - With state for CSRF protection
   ↓
4. User logs in with Google/Apple
   ↓
5. User approves access (consent screen)
   ↓
6. Redirected back to: http://localhost:4000/callback?code=xxx&state=yyy
   ↓
7. Client exchanges code for tokens:
   POST /oauth/token
   - Includes code_verifier for PKCE
   - Receives access_token & refresh_token
   ↓
8. Client fetches user info:
   GET /api/userinfo
   - With Bearer token
   ↓
9. User is authenticated!
   Shows dashboard with user profile
```

### PKCE Flow

```javascript
// 1. Generate code verifier (random string)
const codeVerifier = crypto.randomBytes(32).toString('base64url');

// 2. Generate code challenge (SHA256 hash)
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// 3. Send challenge to authorization endpoint
/oauth/authorize?code_challenge=xxx&code_challenge_method=S256

// 4. Send verifier when exchanging code
POST /oauth/token
code_verifier=xxx
```

## Testing the Flow

### 1. Start Both Servers

Terminal 1 (Gateway):
```bash
cd /home/mli/tigub2b/ologin
npm start
```

Terminal 2 (Sample Client):
```bash
cd /home/mli/tigub2b/ologin/sample_client
npm start
```

### 2. Test Login

1. Visit http://localhost:4000
2. Click "Login with OAuth Gateway"
3. Login with Google/Apple
4. Approve access
5. See your profile on dashboard!

### 3. Test Token Refresh

1. On dashboard, click "🔄 Refresh Token"
2. New access token is issued
3. Page reloads with updated expiry

### 4. Test Logout

1. Click "Logout"
2. Token is revoked on gateway
3. Session cleared
4. Redirected to home

## API Endpoints

### Client Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Home page (login button) |
| `GET /login` | Initiate OAuth flow |
| `GET /callback` | OAuth callback handler |
| `GET /dashboard` | Protected dashboard |
| `POST /refresh` | Refresh access token |
| `GET /logout` | Logout & revoke token |
| `GET /health` | Health check |

### Gateway Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /oauth/authorize` | Authorization endpoint |
| `POST /oauth/token` | Token endpoint |
| `POST /oauth/revoke` | Token revocation |
| `GET /api/userinfo` | User profile (OIDC) |

## Code Structure

```
sample_client/
├── server.js              # Main application
├── package.json           # Dependencies
├── .env.example           # Config template
├── views/
│   ├── index.ejs         # Home page
│   ├── dashboard.ejs     # User dashboard
│   └── error.ejs         # Error page
└── README.md             # This file
```

## Security Features

### PKCE (Proof Key for Code Exchange)
- Prevents authorization code interception
- Required for public clients (mobile/SPA)
- Uses SHA256 code challenge

### State Parameter
- CSRF protection
- Prevents cross-site request forgery
- Random value verified on callback

### Token Storage
- Access tokens in session (server-side)
- Not exposed to client JavaScript
- Secure session cookies

### Token Revocation
- Tokens revoked on logout
- Prevents replay attacks
- Gateway maintains revocation list

## Troubleshooting

### "OAuth client not configured"

**Solution:** Set `CLIENT_ID` and `CLIENT_SECRET` in `.env`

### "Invalid redirect_uri"

**Solution:** Ensure redirect URI matches exactly:
- Gateway client config: `http://localhost:4000/callback`
- Client .env: `REDIRECT_URI=http://localhost:4000/callback`

### "Invalid state parameter"

**Solution:**
- Don't reuse authorization URLs
- State expires after 10 minutes
- Each login generates new state

### "Token expired"

**Solution:** Click "Refresh Token" button on dashboard

### Gateway connection error

**Solution:**
- Ensure gateway is running on port 3000
- Check `GATEWAY_URL` in `.env`
- Test: http://localhost:3000/health

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Client app port | 4000 |
| `GATEWAY_URL` | OAuth Gateway URL | http://localhost:3000 |
| `CLIENT_ID` | OAuth client ID | (required) |
| `CLIENT_SECRET` | OAuth client secret | (required) |
| `REDIRECT_URI` | OAuth callback URL | http://localhost:4000/callback |
| `SESSION_SECRET` | Session encryption key | (change in prod) |

## Production Considerations

### 1. HTTPS Required
```javascript
// Use HTTPS in production
const GATEWAY_URL = 'https://auth.example.com';
const REDIRECT_URI = 'https://app.example.com/callback';

// Secure cookies
cookie: {
  secure: true,  // HTTPS only
  httpOnly: true,
  sameSite: 'lax'
}
```

### 2. Store Secrets Securely
- Use environment variables
- Never commit `.env` to git
- Use secrets manager in production

### 3. Use Redis for Code Verifiers
```javascript
// Instead of Map (in-memory)
const redis = require('redis');
const client = redis.createClient();

// Store verifier
await client.setex(`pkce:${state}`, 600, codeVerifier);

// Retrieve verifier
const verifier = await client.get(`pkce:${state}`);
```

### 4. Error Handling
- Log all OAuth errors
- Monitor token refresh failures
- Alert on high error rates

## License

MIT
