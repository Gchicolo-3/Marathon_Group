// Session cookie + allowlist checks. Run: node scripts/test-auth.mjs
import assert from 'node:assert';
process.env.TOKEN_ENC_KEY = 'test-only-passphrase-0123456789abcdef';
process.env.ALLOWED_EMAILS = 'owner@example.com, Tester@Example.com';
const auth = await import('../lib/auth.js');
const google = await import('../lib/google.js');

const c = await auth.sessionFor('owner@example.com');
assert.strictEqual(await auth.sessionEmail(c), 'owner@example.com', 'valid session');
assert.strictEqual(await auth.sessionEmail(await auth.sessionFor('tester@example.com')), 'tester@example.com', 'case-insensitive allowlist');
assert.strictEqual(await auth.sessionEmail(await auth.sessionFor('stranger@example.com')), null, 'not on list');
const [p, s] = c.split('.');
assert.strictEqual(await auth.sessionEmail(`${p}.${s.slice(0, -2)}xx`), null, 'tampered signature');
assert.strictEqual(await auth.sessionEmail('a'.repeat(64)), null, 'old password-style cookie rejected');
process.env.ALLOWED_EMAILS = 'tester@example.com';
assert.strictEqual(await auth.sessionEmail(c), null, 'removing an address revokes its session');

process.env.GOOGLE_REDIRECT_URI = 'https://prod.example.com/api/google/callback';
assert.strictEqual(google.redirectUriFor('https://prod.example.com'), 'https://prod.example.com/api/google/callback');
assert.strictEqual(google.redirectUriFor('https://preview.example.com'), 'https://preview.example.com/api/google/callback');
console.log('auth tests passed');
