const express = require('express');
const router = express.Router();
const models = require('../db/models');

// Middleware to check admin authentication
function requireAdminAuth(req, res, next) {
  if (!req.session.adminAuthenticated) {
    return res.redirect('/admin/login');
  }
  next();
}

// Admin login page
router.get('/login', (req, res) => {
  if (req.session.adminAuthenticated) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: null });
});

// Admin login handler
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY;

  if (password === adminPassword) {
    req.session.adminAuthenticated = true;
    return res.redirect('/admin');
  }

  res.render('admin/login', { error: 'Invalid password' });
});

// Admin logout
router.get('/logout', (req, res) => {
  req.session.adminAuthenticated = false;
  res.redirect('/admin/login');
});

// Admin dashboard
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    // Get statistics
    const clients = await models.listClients();
    const stats = {
      totalClients: clients.length,
      activeClients: clients.filter(c => c.active).length
    };

    res.render('admin/dashboard', {
      stats,
      clients: clients.map(c => ({
        ...c,
        redirect_uris: typeof c.redirect_uris === 'string' ? JSON.parse(c.redirect_uris) : c.redirect_uris
      }))
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// Create client page
router.get('/clients/new', requireAdminAuth, (req, res) => {
  res.render('admin/client-form', {
    client: null,
    error: null,
    success: null
  });
});

// Create client handler
router.post('/clients', requireAdminAuth, async (req, res) => {
  try {
    const { name, description, redirectUris, logoUrl, websiteUrl } = req.body;

    // Parse redirect URIs (one per line)
    const uris = redirectUris.split('\n')
      .map(uri => uri.trim())
      .filter(uri => uri.length > 0);

    if (uris.length === 0) {
      return res.render('admin/client-form', {
        client: null,
        error: 'At least one redirect URI is required',
        success: null
      });
    }

    const client = await models.createClient({
      name: name.trim(),
      description: description?.trim() || null,
      redirectUris: uris,
      allowedScopes: ['openid', 'profile', 'email'],
      isConfidential: true,
      logoUrl: logoUrl?.trim() || null,
      websiteUrl: websiteUrl?.trim() || null
    });

    // Store client secret in session to show once
    req.session.newClientSecret = {
      clientId: client.client_id,
      clientSecret: client.plainSecret,
      clientName: client.client_name
    };

    // Explicitly save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/admin?error=session_failed');
      }
      res.redirect('/admin/clients/created');
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.render('admin/client-form', {
      client: null,
      error: 'Failed to create client: ' + error.message,
      success: null
    });
  }
});

// Show newly created client credentials
router.get('/clients/created', requireAdminAuth, (req, res) => {
  console.log('Accessing /clients/created page');
  console.log('Session data:', req.session.newClientSecret);

  const clientInfo = req.session.newClientSecret;

  if (!clientInfo) {
    console.log('No client info in session, redirecting to admin');
    return res.redirect('/admin');
  }

  // Clear from session after showing
  delete req.session.newClientSecret;

  console.log('Rendering client-created page with client:', clientInfo.clientId);
  res.render('admin/client-created', { client: clientInfo });
});

// Regenerate client secret
router.post('/clients/:clientId/regenerate-secret', requireAdminAuth, async (req, res) => {
  try {
    console.log('Regenerating secret for client:', req.params.clientId);
    const client = await models.regenerateClientSecret(req.params.clientId);
    console.log('Secret regenerated successfully:', client.client_id);

    // Store new secret in session to show once
    req.session.newClientSecret = {
      clientId: client.client_id,
      clientSecret: client.plainSecret,
      clientName: client.client_name
    };

    // Explicitly save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/admin?error=session_failed');
      }
      console.log('Session saved, redirecting to created page');
      res.redirect('/admin/clients/created');
    });
  } catch (error) {
    console.error('Regenerate secret error:', error);
    res.redirect('/admin?error=regenerate_failed');
  }
});

// Delete client
router.post('/clients/:clientId/delete', requireAdminAuth, async (req, res) => {
  try {
    await models.deleteClient(req.params.clientId);
    res.redirect('/admin?deleted=1');
  } catch (error) {
    console.error('Delete client error:', error);
    res.redirect('/admin?error=delete_failed');
  }
});

module.exports = router;
