require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Configuration
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:4000/callback';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'sample-client-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// In-memory storage for PKCE verifiers (use Redis in production)
const codeVerifiers = new Map();

// Helper: Generate PKCE code verifier and challenge
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

// Helper: Generate random state for CSRF protection
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Routes

// Home page
app.get('/', (req, res) => {
  res.render('index', {
    user: req.session.user,
    clientId: CLIENT_ID,
    configured: !!(CLIENT_ID && CLIENT_SECRET)
  });
});

// Initiate OAuth login
app.get('/login', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send('OAuth client not configured. Please set CLIENT_ID and CLIENT_SECRET in .env');
  }

  // Generate PKCE parameters
  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();

  // Store code verifier for later use
  codeVerifiers.set(state, codeVerifier);

  // Clean up old verifiers (older than 10 minutes)
  setTimeout(() => codeVerifiers.delete(state), 10 * 60 * 1000);

  // Get provider from query param (google or apple)
  const provider = req.query.provider || 'google';

  // Build authorization URL
  const authUrl = new URL(`${GATEWAY_URL}/oauth/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('provider', provider); // Pass provider to gateway

  console.log(`🔐 Initiating OAuth flow with ${provider}...`);
  console.log('Redirecting to:', authUrl.toString());

  res.redirect(authUrl.toString());
});

// OAuth callback
app.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Check for errors
  if (error) {
    console.error('❌ OAuth error:', error, error_description);
    return res.render('error', {
      error: error,
      description: error_description || 'Authorization failed'
    });
  }

  // Validate state and get code verifier
  const codeVerifier = codeVerifiers.get(state);
  if (!codeVerifier) {
    console.error('❌ Invalid state parameter');
    return res.render('error', {
      error: 'invalid_state',
      description: 'Invalid or expired state parameter. Please try again.'
    });
  }

  // Clean up used verifier
  codeVerifiers.delete(state);

  try {
    console.log('🔄 Exchanging authorization code for tokens...');

    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      `${GATEWAY_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code_verifier: codeVerifier
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;

    console.log('✓ Tokens received');
    console.log('  Access token:', access_token.substring(0, 20) + '...');
    console.log('  Expires in:', expires_in, 'seconds');
    console.log('  Scope:', scope);

    // Fetch user info
    console.log('👤 Fetching user info...');
    const userResponse = await axios.get(`${GATEWAY_URL}/api/userinfo`, {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const user = userResponse.data;
    console.log('✓ User info retrieved:', user.email);

    // Store in session
    req.session.user = user;
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;
    req.session.tokenExpiry = Date.now() + (expires_in * 1000);

    res.redirect('/dashboard');
  } catch (error) {
    console.error('❌ Token exchange failed:', error.response?.data || error.message);
    res.render('error', {
      error: 'token_exchange_failed',
      description: error.response?.data?.error_description || error.message
    });
  }
});

// Dashboard (protected)
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  res.render('dashboard', {
    user: req.session.user,
    accessToken: req.session.accessToken,
    tokenExpiry: req.session.tokenExpiry
  });
});

// Refresh token
app.post('/refresh', async (req, res) => {
  if (!req.session.refreshToken) {
    return res.status(401).json({ error: 'No refresh token available' });
  }

  try {
    console.log('🔄 Refreshing access token...');

    const tokenResponse = await axios.post(
      `${GATEWAY_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: req.session.refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // Update session
    req.session.accessToken = access_token;
    req.session.tokenExpiry = Date.now() + (expires_in * 1000);

    console.log('✓ Token refreshed');

    res.json({ success: true, expiresIn: expires_in });
  } catch (error) {
    console.error('❌ Token refresh failed:', error.response?.data || error.message);
    res.status(500).json({
      error: 'refresh_failed',
      description: error.response?.data?.error_description || error.message
    });
  }
});

// Logout
app.get('/logout', async (req, res) => {
  // Optionally revoke tokens
  if (req.session.accessToken) {
    try {
      await axios.post(
        `${GATEWAY_URL}/oauth/revoke`,
        new URLSearchParams({
          token: req.session.accessToken,
          token_type_hint: 'access_token',
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      console.log('✓ Token revoked');
    } catch (error) {
      console.error('⚠️  Token revocation failed:', error.message);
    }
  }

  // Clear session
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.redirect('/');
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: !!(CLIENT_ID && CLIENT_SECRET),
    gateway: GATEWAY_URL
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   OAuth Sample Client                  ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Gateway URL: ${GATEWAY_URL}`);
  console.log(`✓ Client ID: ${CLIENT_ID ? CLIENT_ID.substring(0, 20) + '...' : '⚠️  Not configured'}`);
  console.log(`✓ Redirect URI: ${REDIRECT_URI}\n`);

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('⚠️  WARNING: OAuth client not configured!');
    console.log('   Please update .env with CLIENT_ID and CLIENT_SECRET');
    console.log('   Get these from the admin panel at http://localhost:3000/admin\n');
  } else {
    console.log('✓ OAuth client configured');
    console.log('  Visit http://localhost:4000 to test!\n');
  }
});
