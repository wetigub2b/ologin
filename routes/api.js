const express = require('express');
const router = express.Router();
const models = require('../db/models');
const tokenUtils = require('../oauth/tokenUtils');

// Middleware to validate Bearer token
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Verify JWT
  const verification = tokenUtils.verifyAccessToken(token);

  if (!verification.valid) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check if token exists in database and is not revoked
  const tokenRecord = await models.getAccessToken(token);

  if (!tokenRecord) {
    return res.status(401).json({ error: 'Token not found or revoked' });
  }

  // Get user info
  const user = await models.getUserById(tokenRecord.user_id);

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  req.tokenPayload = verification.payload;
  req.scope = tokenRecord.scope;

  next();
}

// ==================== USERINFO ENDPOINT (OIDC Standard) ====================
// GET /api/userinfo - OpenID Connect UserInfo endpoint
router.get('/userinfo', authenticateToken, async (req, res) => {
  try {
    const scopes = req.scope ? req.scope.split(' ') : [];

    const userInfo = {
      sub: req.user.id.toString()
    };

    // Return claims based on requested scope
    if (scopes.includes('profile')) {
      userInfo.name = req.user.display_name;
      userInfo.picture = req.user.photo_url;
      userInfo.updated_at = Math.floor(new Date(req.user.updated_at).getTime() / 1000);
    }

    if (scopes.includes('email')) {
      userInfo.email = req.user.email;
      userInfo.email_verified = true; // Assuming verified through OAuth provider
    }

    // Include provider information
    if (scopes.includes('openid')) {
      userInfo.provider = req.user.provider;
    }

    res.json(userInfo);
  } catch (error) {
    console.error('UserInfo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== TOKEN VALIDATION ====================
// GET /api/validate - Quick token validation for client apps
router.get('/validate', authenticateToken, async (req, res) => {
  res.json({
    valid: true,
    user_id: req.user.id,
    email: req.user.email,
    name: req.user.display_name,
    provider: req.user.provider,
    scope: req.scope
  });
});

// ==================== CLIENT MANAGEMENT ====================
// Admin middleware (simple implementation - enhance with proper admin auth)
function requireAdmin(req, res, next) {
  // Simple admin check - you should implement proper admin authentication
  const adminKey = req.headers['x-admin-key'];

  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

// POST /api/admin/clients - Create new OAuth client
router.post('/admin/clients', requireAdmin, async (req, res) => {
  try {
    const { name, description, redirectUris, allowedScopes, isConfidential, logoUrl, websiteUrl, privacyPolicyUrl, termsOfServiceUrl } = req.body;

    if (!name || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: name, redirectUris'
      });
    }

    const client = await models.createClient({
      name,
      description,
      redirectUris,
      allowedScopes: allowedScopes || ['openid', 'profile', 'email'],
      isConfidential: isConfidential !== false,
      logoUrl,
      websiteUrl,
      privacyPolicyUrl,
      termsOfServiceUrl
    });

    res.status(201).json({
      client_id: client.client_id,
      client_secret: client.plainSecret, // Only returned once!
      client_name: client.client_name,
      redirect_uris: typeof client.redirect_uris === 'string' ? JSON.parse(client.redirect_uris) : client.redirect_uris,
      allowed_scopes: typeof client.allowed_scopes === 'string' ? JSON.parse(client.allowed_scopes) : client.allowed_scopes,
      message: 'IMPORTANT: Save the client_secret now. It will not be shown again!'
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/clients - List all clients
router.get('/admin/clients', requireAdmin, async (req, res) => {
  try {
    const clients = await models.listClients();

    // Parse JSON fields
    const formattedClients = clients.map(client => ({
      ...client,
      redirect_uris: typeof client.redirect_uris === 'string' ? JSON.parse(client.redirect_uris) : client.redirect_uris,
      client_secret: undefined // Don't expose secrets
    }));

    res.json({ clients: formattedClients });
  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/clients/:clientId - Delete/deactivate client
router.delete('/admin/clients/:clientId', requireAdmin, async (req, res) => {
  try {
    await models.deleteClient(req.params.clientId);
    res.json({ message: 'Client deactivated successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== USER CONSENT MANAGEMENT ====================
// GET /api/consents - List user's app authorizations
router.get('/consents', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const consents = await models.listUserConsents(req.user.id);
    res.json({ consents });
  } catch (error) {
    console.error('List consents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/consents/:clientId - Revoke app authorization
router.delete('/consents/:clientId', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await models.revokeUserConsent(req.user.id, req.params.clientId);
    res.json({ message: 'Authorization revoked successfully' });
  } catch (error) {
    console.error('Revoke consent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
