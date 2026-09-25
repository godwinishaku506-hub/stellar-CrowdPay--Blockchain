const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const proxyquire = require('proxyquire').noCallThru();

function buildAuthModule(overrides = {}) {
  const tokensDb = new Map();
  const queries = [];

  const mockDb = {
    query: async (text, params) => {
      queries.push({ text, params });
      if (text.includes('INSERT INTO refresh_tokens')) {
        const [userId, tokenHash, expiresAt, familyId] = params;
        const id = crypto.randomUUID();
        tokensDb.set(tokenHash, {
          id,
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          family_id: familyId,
          revoked_at: null,
        });
        return { rows: [{ id, family_id: familyId }] };
      }
      if (text.includes('SELECT rt.id AS token_id') && text.includes('FROM refresh_tokens rt')) {
        const [tokenHash] = params;
        const record = tokensDb.get(tokenHash);
        if (!record) return { rows: [] };
        return {
          rows: [
            {
              token_id: record.id,
              user_id: record.user_id,
              family_id: record.family_id,
              revoked_at: record.revoked_at,
              expires_at: record.expires_at,
              id: record.user_id,
              email: 'test@example.com',
              name: 'Test User',
              role: 'creator',
              wallet_public_key: 'GBTESTKEY123',
              wallet_type: 'custodial',
              kyc_status: 'approved',
              kyc_completed_at: new Date(),
            },
          ],
        };
      }
      if (text.includes('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1')) {
        const [tokenHash] = params;
        const record = tokensDb.get(tokenHash);
        if (record) record.revoked_at = new Date();
        return { rows: [] };
      }
      if (text.includes('UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1')) {
        const [familyId] = params;
        for (const record of tokensDb.values()) {
          if (record.family_id === familyId) {
            record.revoked_at = new Date();
          }
        }
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const auth = proxyquire('./auth', {
    '../config/database': overrides.db || mockDb,
    '../config/logger': { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
    '../middleware/validation': {
      validateRequest: (req, res, next) => next(),
      validateRequestAsError: (req, res, next) => next(),
      registerValidation: [],
      loginValidation: [],
      forgotPasswordValidation: [],
      resetPasswordValidation: [],
    },
    '../services/stellarService': {
      ensureCustodialAccountFundedAndTrusted: async () => {},
    },
    '../services/kycProvider': {
      isKycRequiredForCampaigns: () => false,
    },
    '../services/emailService': {
      sendEmail: async () => {},
    },
    ...overrides.modules,
  });

  return { auth, tokensDb, queries };
}

test('refresh token creation assigns a family_id', async () => {
  const { auth, tokensDb } = buildAuthModule();
  const userId = crypto.randomUUID();
  const { token, familyId } = await auth.createRefreshToken(userId);

  assert.ok(token);
  assert.ok(familyId);
  const hash = auth.hashToken(token);
  const stored = tokensDb.get(hash);
  assert.equal(stored.family_id, familyId);
  assert.equal(stored.revoked_at, null);
});

test('single-use rotation revokes previous token and continues family', async () => {
  const { auth, tokensDb } = buildAuthModule();
  const userId = crypto.randomUUID();
  const { token: t1, familyId: f1 } = await auth.createRefreshToken(userId);

  const { token: t2, familyId: f2 } = await auth.rotateRefreshToken(t1, userId, f1);

  assert.equal(f1, f2, 'Rotated token should belong to the same session family');
  const h1 = auth.hashToken(t1);
  const h2 = auth.hashToken(t2);

  assert.ok(tokensDb.get(h1).revoked_at !== null, 'Prior token must be marked revoked');
  assert.equal(tokensDb.get(h2).revoked_at, null, 'New token must be active');
});

test('replay of an already-rotated token revokes all tokens in the family', async () => {
  const { auth, tokensDb } = buildAuthModule();
  const userId = crypto.randomUUID();
  const { token: t1, familyId } = await auth.createRefreshToken(userId);

  // Normal rotation: t1 -> t2
  const { token: t2 } = await auth.rotateRefreshToken(t1, userId, familyId);
  const h2 = auth.hashToken(t2);
  assert.equal(tokensDb.get(h2).revoked_at, null, 't2 is initially active');

  // Attacker replays already-rotated t1
  const validationResult = await auth.validateRefreshToken(t1);
  assert.ok(validationResult);
  assert.equal(validationResult.reuseDetected, true, 'Replay must be flagged');

  // Reuse detection must have revoked t2 as well
  assert.ok(tokensDb.get(h2).revoked_at !== null, 'Active sibling in family must be revoked on replay');
});
