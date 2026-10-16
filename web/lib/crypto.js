// AES-256-GCM for OAuth tokens at rest. The key comes from TOKEN_ENC_KEY
// (any long random string; it is hashed to 32 bytes). Never log the output.
const crypto = require('crypto');

function key() {
  const k = process.env.TOKEN_ENC_KEY;
  if (!k || k.length < 16) throw new Error('TOKEN_ENC_KEY is not set (use a long random string)');
  return crypto.createHash('sha256').update(k).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

function decrypt(payload) {
  const [iv, tag, enc] = String(payload).split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
