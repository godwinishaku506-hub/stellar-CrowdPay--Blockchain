const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const raw = process.env.WALLET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'WALLET_ENCRYPTION_KEY is not set. ' +
      'Generate one with: node -e "require(\'crypto\').randomBytes(32).toString(\'hex\')" ' +
      'and add it to your .env file.'
    );
  }
  const key = Buffer.from(raw.trim().slice(0, 64), 'hex');
  if (key.length !== 32) {
    throw new Error('WALLET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return key;
}

function encryptSecret(secret) {
  const KEY = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(encryptedData) {
  const KEY = getKey();
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(Buffer.from(encryptedHex, 'hex'), null, 'utf8') + decipher.final('utf8');
}

module.exports = { encryptSecret, decryptSecret };
