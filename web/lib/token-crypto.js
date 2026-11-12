// AES-256-GCM for OAuth tokens at rest. The key comes from TOKEN_ENC_KEY
// (32 bytes as 64 hex chars, or base64). Output is a single string,
// "v1.<iv>.<tag>.<ciphertext>" in base64url, so it fits a text column.
// Nothing in here logs plaintext or key material.
const crypto = require('crypto');

const PREFIX = 'v1';

function loadKey() {
  const raw = (process.env.TOKEN_ENC_KEY || '').trim();
  if (!raw) throw new Error('TOKEN_ENC_KEY is not set');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const b64 = Buffer.from(raw, 'base64');
  if (b64.length === 32 && /^[A-Za-z0-9+/=_-]+$/.test(raw)) return b64;
  // Any long passphrase works too (so it can be set from a phone without a
  // terminal): it is stretched to 32 bytes with SHA-256.
  if (raw.length >= 24) return crypto.createHash('sha256').update(raw, 'utf8').digest();
  throw new Error('TOKEN_ENC_KEY must be at least 24 characters (or 64 hex chars from openssl rand -hex 32)');
}

function encrypt(plaintext) {
  if (plaintext == null) return null;
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

function decrypt(blob) {
  if (blob == null) return null;
  const [prefix, iv, tag, ct] = String(blob).split('.');
  if (prefix !== PREFIX || !iv || !tag || !ct) throw new Error('Unrecognized token blob');
  const key = loadKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]);
  return pt.toString('utf8');
}

module.exports = { encrypt, decrypt };
