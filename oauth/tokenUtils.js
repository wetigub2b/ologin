const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://your-domain.com';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'oauth-clients';

// Generate JWT access token
function generateAccessToken(user, client, scope) {
  const payload = {
    sub: user.id.toString(),
    aud: client.client_id, // Audience is the client_id
    scope: scope || 'openid profile email',
    provider: user.provider,
    email: user.email,
    name: user.display_name
  };

  const options = {
    expiresIn: '24h', // 24 hours
    issuer: JWT_ISSUER
    // Don't set audience in options since it's already in payload
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

// Verify and decode JWT token
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER
      // Audience is client_id, checked separately if needed
    });
    return { valid: true, payload: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// PKCE helpers
function generateCodeChallenge(codeVerifier) {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
}

function verifyCodeChallenge(codeVerifier, codeChallenge, method = 'S256') {
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }

  if (method === 'S256') {
    const computed = generateCodeChallenge(codeVerifier);
    return computed === codeChallenge;
  }

  return false;
}

// Validate redirect URI
function validateRedirectUri(provided, allowed) {
  if (!Array.isArray(allowed)) {
    allowed = typeof allowed === 'string' ? JSON.parse(allowed) : [];
  }
  return allowed.includes(provided);
}

// Validate scope
function validateScope(requestedScope, allowedScopes) {
  if (!Array.isArray(allowedScopes)) {
    allowedScopes = typeof allowedScopes === 'string' ? JSON.parse(allowedScopes) : [];
  }

  if (!requestedScope) return true;

  const requested = requestedScope.split(' ');
  return requested.every(scope => allowedScopes.includes(scope));
}

// Parse scope string
function parseScope(scopeString) {
  if (!scopeString) return ['openid', 'profile', 'email'];
  return scopeString.split(' ');
}

// Generate state parameter (CSRF protection)
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateCodeChallenge,
  verifyCodeChallenge,
  validateRedirectUri,
  validateScope,
  parseScope,
  generateState
};
