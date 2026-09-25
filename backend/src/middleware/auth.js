const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const Sentry = require('@sentry/node');

function apiKeyPepper() {
  return process.env.API_KEY_PEPPER || process.env.JWT_SECRET || 'dev-api-key-pepper';
}

function hashApiKey(rawKey) {
  return crypto.createHmac('sha256', apiKeyPepper()).update(rawKey, 'utf8').digest('hex');
}

async function authenticate(req) {
  const header = req.headers.authorization;
  const token = req.cookies?.cp_token || (header && header.startsWith('Bearer ') ? header.slice(7).trim() : null);
  if (!token) throw new Error('Missing token');

  if (token.startsWith('cp_live_')) {
    const keyHash = hashApiKey(token);
    const { rows } = await db.query(
      `SELECT id, user_id, scopes FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
      [keyHash]
    );
    if (!rows.length) throw new Error('Invalid API key');
    await db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [rows[0].id]);
    req.user = { userId: rows[0].user_id };
    req.auth = { kind: 'api_key', apiKeyId: rows[0].id, scopes: rows[0].scopes || [] };
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    req.auth = { kind: 'jwt', scopes: null };
    
    // Load admin status, role, and ban flag from database on every request.
    // This ensures that role demotions, promotions and bans take effect
    // immediately without waiting for token expiry (issue #18 and #19).
    if (req.user.userId) {
      const { rows } = await db.query(
        'SELECT role, is_admin, is_super_admin, is_banned FROM users WHERE id = $1',
        [req.user.userId]
      );
      if (rows.length) {
        req.user.role = rows[0].role;
        req.user.is_admin = rows[0].is_admin;
        req.user.is_super_admin = rows[0].is_super_admin;
        req.user.is_banned = rows[0].is_banned;
      }
    }
  } catch {
    throw new Error('Invalid token');
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Requires admin privileges' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.is_super_admin) {
    return res.status(403).json({ error: 'Requires super-admin privileges' });
  }
  next();
}

function requireRole(...roles) {
  const allowed = new Set(roles);
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Requires authenticated user role' });
    }
    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role for this action' });
    }
    next();
  };
}

/**
 * API keys carry scope arrays. JWT sessions retain full access.
 * @returns {boolean} false if response was sent (403)
 */
function assertApiKeyScopes(req, res) {
  if (!req.auth || req.auth.kind !== 'api_key') return true;
  const scopes = req.auth.scopes || [];
  if (scopes.includes('full')) return true;

  const path = req.originalUrl.split('?')[0];
  const method = req.method;

  if (path.startsWith('/api/api-keys') || path.startsWith('/api/webhooks')) {
    if (!scopes.includes('developer')) {
      res.status(403).json({ error: 'API key requires developer scope for this resource' });
      return false;
    }
    return true;
  }

  if (path.startsWith('/api/withdrawals')) {
    if (method === 'GET') {
      if (!scopes.includes('read')) {
        res.status(403).json({ error: 'API key requires read scope' });
        return false;
      }
      return true;
    }
    if (!scopes.includes('withdrawals')) {
      res.status(403).json({ error: 'API key requires withdrawals scope for withdrawal actions' });
      return false;
    }
    return true;
  }

  if (method === 'GET' || method === 'HEAD') {
    if (!scopes.includes('read')) {
      res.status(403).json({ error: 'API key requires read scope' });
      return false;
    }
    return true;
  }

  if (!scopes.includes('write')) {
    res.status(403).json({ error: 'API key requires write scope' });
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  authenticate(req)
    .then(() => {
      // Enforce ban server-side on every request regardless of token validity.
      // is_banned is re-read from DB in authenticate() so bans take effect immediately.
      if (req.user?.is_banned) {
        return res.status(403).json({ error: 'Your account has been suspended' });
      }
      if (!assertApiKeyScopes(req, res)) return;
      if (req.user?.userId) Sentry.setUser({ id: req.user.userId });
      next();
    })
    .catch((err) => {
      const msg = err.message === 'Missing token' ? err.message : 'Unauthorized';
      res.status(401).json({ error: msg });
    });
}

module.exports = {
  requireAuth,
  authenticate,
  assertApiKeyScopes,
  hashApiKey,
  requireAdmin,
  requireSuperAdmin,
  requireRole,
};
