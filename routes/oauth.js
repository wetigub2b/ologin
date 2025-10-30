const express = require('express');
const router = express.Router();
const models = require('../db/models');
const tokenUtils = require('../oauth/tokenUtils');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    // Save the original OAuth request to return after login
    req.session.returnTo = req.originalUrl;
    console.log('🔐 User not authenticated, saving returnTo:', req.originalUrl);

    // Save session explicitly before redirect
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
      }

      // Get preferred provider from query param (google or apple)
      const provider = req.query.provider || 'google'; // default to google

      // Redirect directly to provider login
      if (provider === 'apple') {
        return res.redirect('/auth/apple');
      } else {
        return res.redirect('/auth/google');
      }
    });
    return;
  }
  next();
}

// ==================== AUTHORIZATION ENDPOINT ====================
// GET /oauth/authorize - OAuth 2.0 authorization endpoint
router.get('/authorize', requireAuth, async (req, res) => {
  try {
    const {
      client_id,
      redirect_uri,
      response_type,
      scope,
      state,
      code_challenge,
      code_challenge_method
    } = req.query;

    // Validate required parameters
    if (!client_id || !redirect_uri || response_type !== 'code') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing or invalid required parameters'
      });
    }

    // Validate client
    const client = await models.getClientById(client_id);
    if (!client) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Client not found'
      });
    }

    // Validate redirect URI
    if (!tokenUtils.validateRedirectUri(redirect_uri, client.redirect_uris)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid redirect_uri'
      });
    }

    // Validate scope
    const requestedScope = scope || 'openid profile email';
    if (!tokenUtils.validateScope(requestedScope, client.allowed_scopes)) {
      return res.status(400).json({
        error: 'invalid_scope',
        error_description: 'Requested scope not allowed'
      });
    }

    // Check if user has already consented
    const existingConsent = await models.getUserConsent(req.user.id, client_id);

    if (existingConsent) {
      // User has already consented, generate code immediately
      const code = await models.createAuthorizationCode({
        clientId: client_id,
        userId: req.user.id,
        redirectUri: redirect_uri,
        scope: requestedScope,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method
      });

      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state);

      return res.redirect(redirectUrl.toString());
    }

    // Show consent screen
    res.render('consent', {
      user: req.user,
      client,
      scope: tokenUtils.parseScope(requestedScope),
      authParams: {
        client_id,
        redirect_uri,
        response_type,
        scope: requestedScope,
        state,
        code_challenge,
        code_challenge_method
      }
    });
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

// POST /oauth/authorize - Handle user consent
router.post('/authorize', requireAuth, async (req, res) => {
  try {
    const {
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
      action
    } = req.body;

    if (action === 'deny') {
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'User denied access');
      if (state) redirectUrl.searchParams.set('state', state);
      return res.redirect(redirectUrl.toString());
    }

    // Create consent record
    await models.createUserConsent(req.user.id, client_id, scope);

    // Generate authorization code
    const code = await models.createAuthorizationCode({
      clientId: client_id,
      userId: req.user.id,
      redirectUri: redirect_uri,
      scope,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method
    });

    // Redirect back to client with code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Authorization consent error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

// ==================== TOKEN ENDPOINT ====================
// POST /oauth/token - OAuth 2.0 token endpoint
router.post('/token', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { grant_type, code, redirect_uri, client_id, client_secret, refresh_token, code_verifier } = req.body;

    // Validate client credentials
    const client = await models.validateClient(client_id, client_secret);
    if (!client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }

    // Handle authorization_code grant
    if (grant_type === 'authorization_code') {
      const authCode = await models.getAuthorizationCode(code);

      if (!authCode) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code'
        });
      }

      if (authCode.client_id !== client_id || authCode.redirect_uri !== redirect_uri) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code mismatch'
        });
      }

      // Verify PKCE if code_challenge was provided
      if (authCode.code_challenge) {
        if (!code_verifier) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'code_verifier required for PKCE'
          });
        }

        if (!tokenUtils.verifyCodeChallenge(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid code_verifier'
          });
        }
      }

      // Mark code as used
      await models.markCodeAsUsed(code);

      // Get user data
      const user = await models.getUserById(authCode.user_id);

      // Generate JWT access token
      const accessToken = tokenUtils.generateAccessToken(user, client, authCode.scope);

      // Store access token
      const accessTokenRecord = await models.createAccessToken({
        token: accessToken,
        clientId: client_id,
        userId: user.id,
        scope: authCode.scope
      });

      // Generate refresh token
      const refreshTokenRecord = await models.createRefreshToken({
        clientId: client_id,
        userId: user.id,
        scope: authCode.scope,
        accessTokenId: accessTokenRecord.id
      });

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400, // 24 hours
        refresh_token: refreshTokenRecord.token,
        scope: authCode.scope
      });
    }

    // Handle refresh_token grant
    if (grant_type === 'refresh_token') {
      const refreshTokenRecord = await models.getRefreshToken(refresh_token);

      if (!refreshTokenRecord) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired refresh token'
        });
      }

      if (refreshTokenRecord.client_id !== client_id) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Refresh token client mismatch'
        });
      }

      // Get user data
      const user = await models.getUserById(refreshTokenRecord.user_id);

      // Generate new access token
      const accessToken = tokenUtils.generateAccessToken(user, client, refreshTokenRecord.scope);

      // Store new access token
      const accessTokenRecord = await models.createAccessToken({
        token: accessToken,
        clientId: client_id,
        userId: user.id,
        scope: refreshTokenRecord.scope
      });

      // Optional: Rotate refresh token
      // For now, we'll keep the same refresh token

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400, // 24 hours
        refresh_token: refresh_token,
        scope: refreshTokenRecord.scope
      });
    }

    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Grant type not supported'
    });
  } catch (error) {
    console.error('Token endpoint error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

// ==================== REVOCATION ENDPOINT ====================
// POST /oauth/revoke - Token revocation endpoint (RFC 7009)
router.post('/revoke', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { token, token_type_hint, client_id, client_secret } = req.body;

    console.log('🗑️  Token revocation request:', {
      token_type_hint,
      client_id,
      token_preview: token ? token.substring(0, 20) + '...' : 'none'
    });

    // Validate client
    const client = await models.validateClient(client_id, client_secret);
    if (!client) {
      console.log('❌ Invalid client credentials for revocation');
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }

    if (!token) {
      console.log('❌ No token provided for revocation');
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Token parameter required'
      });
    }

    // Try to revoke as access token or refresh token
    if (token_type_hint === 'access_token' || !token_type_hint) {
      await models.revokeAccessToken(token);
      console.log('✓ Access token revoked');
    }

    if (token_type_hint === 'refresh_token' || !token_type_hint) {
      await models.revokeRefreshToken(token);
      console.log('✓ Refresh token revoked');
    }

    // Always return 200 OK per RFC 7009
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Token revocation error:', error);
    res.status(200).json({ success: true }); // Still return 200 per spec
  }
});

// ==================== INTROSPECTION ENDPOINT ====================
// POST /oauth/introspect - Token introspection endpoint (RFC 7662)
router.post('/introspect', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { token, token_type_hint, client_id, client_secret } = req.body;

    // Validate client
    const client = await models.validateClient(client_id, client_secret);
    if (!client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }

    if (!token) {
      return res.json({ active: false });
    }

    // Try to find token
    let tokenRecord;
    let user;

    if (token_type_hint === 'access_token' || !token_type_hint) {
      // Verify JWT token
      const verification = tokenUtils.verifyAccessToken(token);

      if (verification.valid) {
        const tokenData = await models.getAccessToken(token);
        if (tokenData) {
          user = await models.getUserById(tokenData.user_id);
          return res.json({
            active: true,
            scope: tokenData.scope,
            client_id: tokenData.client_id,
            username: user.email,
            token_type: 'Bearer',
            exp: Math.floor(new Date(tokenData.expires_at).getTime() / 1000),
            sub: user.id.toString(),
            aud: tokenData.client_id
          });
        }
      }
    }

    if (token_type_hint === 'refresh_token' || !token_type_hint) {
      tokenRecord = await models.getRefreshToken(token);
      if (tokenRecord) {
        user = await models.getUserById(tokenRecord.user_id);
        return res.json({
          active: true,
          scope: tokenRecord.scope,
          client_id: tokenRecord.client_id,
          username: user.email,
          token_type: 'refresh_token',
          exp: Math.floor(new Date(tokenRecord.expires_at).getTime() / 1000),
          sub: user.id.toString()
        });
      }
    }

    res.json({ active: false });
  } catch (error) {
    console.error('Token introspection error:', error);
    res.json({ active: false });
  }
});

module.exports = router;
