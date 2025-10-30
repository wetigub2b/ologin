const { query } = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ==================== USERS ====================

async function findOrCreateUser(provider, providerData) {
  try {
    // Validate required fields
    if (!provider || !providerData || !providerData.id) {
      throw new Error(`Invalid provider data: provider=${provider}, id=${providerData?.id}`);
    }

    // Convert undefined to null for MySQL compatibility
    const email = providerData.email || null;
    const displayName = providerData.displayName || null;
    const photo = providerData.photo || null;

    // Try to find existing user
    const result = await query(
      'SELECT * FROM users WHERE provider = ? AND provider_id = ?',
      [provider, providerData.id]
    );

    if (result.length > 0) {
      // Update existing user
      await query(
        `UPDATE users
         SET email = ?, display_name = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE provider = ? AND provider_id = ?`,
        [email, displayName, photo, provider, providerData.id]
      );
      return result[0];
    }

    // Create new user
    const insertResult = await query(
      `INSERT INTO users (provider, provider_id, email, display_name, photo_url)
       VALUES (?, ?, ?, ?, ?)`,
      [provider, providerData.id, email, displayName, photo]
    );

    const newUser = await query('SELECT * FROM users WHERE id = ?', [insertResult.insertId]);
    return newUser[0];
  } catch (error) {
    console.error('findOrCreateUser error:', error);
    throw error;
  }
}

async function getUserById(userId) {
  const result = await query('SELECT * FROM users WHERE id = ?', [userId]);
  return result[0];
}

// ==================== OAUTH CLIENTS ====================

async function createClient(clientData) {
  const clientId = uuidv4();
  const clientSecret = crypto.randomBytes(32).toString('hex');
  const hashedSecret = await bcrypt.hash(clientSecret, 10);

  const redirectUris = JSON.stringify(clientData.redirectUris);
  const allowedScopes = JSON.stringify(clientData.allowedScopes || ['openid', 'profile', 'email']);
  const grantTypes = JSON.stringify(clientData.grantTypes || ['authorization_code', 'refresh_token']);

  const result = await query(
    `INSERT INTO oauth_clients
     (client_id, client_secret, client_name, client_description, redirect_uris,
      allowed_scopes, grant_types, is_confidential, logo_url, website_url,
      privacy_policy_url, terms_of_service_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clientId,
      hashedSecret,
      clientData.name,
      clientData.description || null,
      redirectUris,
      allowedScopes,
      grantTypes,
      clientData.isConfidential !== false ? 1 : 0,
      clientData.logoUrl || null,
      clientData.websiteUrl || null,
      clientData.privacyPolicyUrl || null,
      clientData.termsOfServiceUrl || null
    ]
  );

  const newClient = await query('SELECT * FROM oauth_clients WHERE id = ?', [result.insertId]);
  return {
    ...newClient[0],
    plainSecret: clientSecret // Return plain secret only once
  };
}

async function getClientById(clientId) {
  const result = await query(
    'SELECT * FROM oauth_clients WHERE client_id = ? AND active = true',
    [clientId]
  );
  return result[0];
}

async function validateClient(clientId, clientSecret) {
  const client = await getClientById(clientId);
  if (!client) return null;

  const isValid = await bcrypt.compare(clientSecret, client.client_secret);
  return isValid ? client : null;
}

async function listClients() {
  const result = await query(
    'SELECT id, client_id, client_name, client_description, redirect_uris, created_at, active FROM oauth_clients ORDER BY created_at DESC'
  );
  return result;
}

async function deleteClient(clientId) {
  await query('UPDATE oauth_clients SET active = false WHERE client_id = ?', [clientId]);
}

async function regenerateClientSecret(clientId) {
  // Get client without active check (we need to regenerate even if inactive)
  const result = await query(
    'SELECT * FROM oauth_clients WHERE client_id = ?',
    [clientId]
  );

  const client = result[0];
  if (!client) {
    throw new Error('Client not found');
  }

  // Generate new secret
  const newClientSecret = crypto.randomBytes(32).toString('hex');
  const hashedSecret = await bcrypt.hash(newClientSecret, 10);

  // Update in database
  await query(
    'UPDATE oauth_clients SET client_secret = ?, active = true WHERE client_id = ?',
    [hashedSecret, clientId]
  );

  // Revoke all existing tokens for this client
  await query(
    'UPDATE access_tokens SET revoked = true WHERE client_id = ?',
    [clientId]
  );
  await query(
    'UPDATE refresh_tokens SET revoked = true WHERE client_id = ?',
    [clientId]
  );

  return {
    client_id: client.client_id,
    client_name: client.client_name,
    plainSecret: newClientSecret // Return plain secret only once
  };
}

// ==================== AUTHORIZATION CODES ====================

async function createAuthorizationCode(data) {
  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await query(
    `INSERT INTO authorization_codes
     (code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      code,
      data.clientId,
      data.userId,
      data.redirectUri,
      data.scope,
      data.codeChallenge || null,
      data.codeChallengeMethod || null,
      expiresAt
    ]
  );

  return code;
}

async function getAuthorizationCode(code) {
  const result = await query(
    `SELECT * FROM authorization_codes
     WHERE code = ? AND used = false AND expires_at > NOW()`,
    [code]
  );
  return result[0];
}

async function markCodeAsUsed(code) {
  await query('UPDATE authorization_codes SET used = true WHERE code = ?', [code]);
}

// ==================== ACCESS TOKENS ====================

async function createAccessToken(data) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const result = await query(
    `INSERT INTO access_tokens (token, client_id, user_id, scope, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [data.token, data.clientId, data.userId, data.scope, expiresAt]
  );

  const newToken = await query('SELECT * FROM access_tokens WHERE id = ?', [result.insertId]);
  return newToken[0];
}

async function getAccessToken(token) {
  const result = await query(
    `SELECT * FROM access_tokens
     WHERE token = ? AND revoked = false AND expires_at > NOW()`,
    [token]
  );
  return result[0];
}

async function revokeAccessToken(token) {
  await query('UPDATE access_tokens SET revoked = true WHERE token = ?', [token]);
}

// ==================== REFRESH TOKENS ====================

async function createRefreshToken(data) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  const result = await query(
    `INSERT INTO refresh_tokens (token, client_id, user_id, scope, expires_at, access_token_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [token, data.clientId, data.userId, data.scope, expiresAt, data.accessTokenId]
  );

  const newToken = await query('SELECT * FROM refresh_tokens WHERE id = ?', [result.insertId]);
  return newToken[0];
}

async function getRefreshToken(token) {
  const result = await query(
    `SELECT * FROM refresh_tokens
     WHERE token = ? AND revoked = false AND expires_at > NOW()`,
    [token]
  );
  return result[0];
}

async function revokeRefreshToken(token) {
  await query('UPDATE refresh_tokens SET revoked = true WHERE token = ?', [token]);
}

// ==================== USER CONSENTS ====================

async function getUserConsent(userId, clientId) {
  const result = await query(
    `SELECT * FROM user_consents
     WHERE user_id = ? AND client_id = ? AND revoked = false`,
    [userId, clientId]
  );
  return result[0];
}

async function createUserConsent(userId, clientId, scope) {
  await query(
    `INSERT INTO user_consents (user_id, client_id, scope)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE scope = ?, granted_at = CURRENT_TIMESTAMP, revoked = false`,
    [userId, clientId, scope, scope]
  );

  const result = await query(
    'SELECT * FROM user_consents WHERE user_id = ? AND client_id = ?',
    [userId, clientId]
  );
  return result[0];
}

async function revokeUserConsent(userId, clientId) {
  await query(
    'UPDATE user_consents SET revoked = true WHERE user_id = ? AND client_id = ?',
    [userId, clientId]
  );
}

async function listUserConsents(userId) {
  const result = await query(
    `SELECT uc.*, oc.client_name, oc.logo_url
     FROM user_consents uc
     JOIN oauth_clients oc ON uc.client_id = oc.client_id
     WHERE uc.user_id = ? AND uc.revoked = false
     ORDER BY uc.granted_at DESC`,
    [userId]
  );
  return result;
}

module.exports = {
  // Users
  findOrCreateUser,
  getUserById,

  // Clients
  createClient,
  getClientById,
  validateClient,
  listClients,
  deleteClient,
  regenerateClientSecret,

  // Authorization codes
  createAuthorizationCode,
  getAuthorizationCode,
  markCodeAsUsed,

  // Access tokens
  createAccessToken,
  getAccessToken,
  revokeAccessToken,

  // Refresh tokens
  createRefreshToken,
  getRefreshToken,
  revokeRefreshToken,

  // Consents
  getUserConsent,
  createUserConsent,
  revokeUserConsent,
  listUserConsents
};
