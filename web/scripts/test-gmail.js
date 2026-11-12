// Unit tests for the Gmail layer with a mock HTTP client. No database, no
// network. Run: npm run test:gmail
const test = require('node:test');
const assert = require('node:assert');

process.env.TOKEN_ENC_KEY = 'a'.repeat(64);
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.GOOGLE_REDIRECT_URI = 'https://example.test/api/google/callback';
process.env.DATABASE_URL = 'postgresql://unused:unused@localhost/unused';

const { encrypt, decrypt } = require('../lib/token-crypto');
const google = require('../lib/google');

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64url');
const msg = ({ id, from, text, html, labels = [], date = 1 }) => ({
  id, threadId: 't1', internalDate: String(date), labelIds: labels,
  payload: {
    mimeType: 'multipart/alternative',
    headers: [{ name: 'From', value: from }, { name: 'Subject', value: 'Re: hi' }],
    parts: [
      text != null && { mimeType: 'text/plain', body: { data: b64url(text) } },
      html != null && { mimeType: 'text/html', body: { data: b64url(html) } },
    ].filter(Boolean),
  },
});

test('tokens round trip through AES-256-GCM and never appear in the blob', () => {
  const blob = encrypt('1//refresh-token-value');
  assert.ok(blob.startsWith('v1.'));
  assert.ok(!blob.includes('refresh-token-value'));
  assert.strictEqual(decrypt(blob), '1//refresh-token-value');
  assert.notStrictEqual(encrypt('same'), encrypt('same')); // fresh iv each time
  assert.throws(() => decrypt(blob.slice(0, -2) + 'xx'));
});

test('authUrl asks for offline access, consent, and only the two Gmail scopes', () => {
  const u = new URL(google.authUrl('abc'));
  assert.strictEqual(u.searchParams.get('access_type'), 'offline');
  assert.strictEqual(u.searchParams.get('prompt'), 'consent');
  assert.strictEqual(u.searchParams.get('state'), 'abc');
  assert.deepStrictEqual(u.searchParams.get('scope').split(' '), [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ]);
});

test('buildMime produces proper headers and threading fields', () => {
  const { raw, messageId } = google.buildMime({
    from: 'mike@marathongroupllc.com', fromName: 'Mike Sullivan',
    to: 'jane@example.com', toName: 'Jane Doe',
    subject: 'Quick question — façade', body: 'Hi Jane,\n\nLine two.',
    inReplyTo: '<prev@marathongroupllc.com>', references: '<prev@marathongroupllc.com>',
  });
  const mime = Buffer.from(raw, 'base64url').toString('utf8');
  assert.match(messageId, /^<[0-9a-f-]+@marathongroupllc\.com>$/);
  assert.ok(mime.includes('From: Mike Sullivan <mike@marathongroupllc.com>\r\n'));
  assert.ok(mime.includes('To: Jane Doe <jane@example.com>\r\n'));
  assert.ok(mime.includes('Subject: =?UTF-8?B?')); // non ascii subject is encoded
  assert.ok(mime.includes(`Message-ID: ${messageId}\r\n`));
  assert.ok(mime.includes('In-Reply-To: <prev@marathongroupllc.com>\r\n'));
  assert.ok(mime.includes('Content-Type: text/plain; charset="UTF-8"'));
  const bodyB64 = mime.split('\r\n\r\n')[1].replace(/\r\n/g, '');
  assert.strictEqual(Buffer.from(bodyB64, 'base64').toString('utf8'), 'Hi Jane,\r\n\r\nLine two.');
});

test('replyMessagesInThread skips our own, SENT, and already seen messages', () => {
  const thread = {
    messages: [
      msg({ id: 'm1', from: 'Mike <mike@marathongroupllc.com>', text: 'intro', labels: ['SENT'], date: 1 }),
      msg({ id: 'm2', from: 'Jane Doe <jane@example.com>', text: 'Sure, send me info.\n\nOn Mon, Jan 1, Mike wrote:\n> intro', date: 2 }),
      msg({ id: 'm3', from: 'jane@example.com', html: '<p>Thanks!</p><div>Call me</div>', date: 3 }),
      msg({ id: 'm4', from: 'Mike Sullivan <MIKE@marathongroupllc.com>', text: 'my follow up', date: 4 }),
    ],
  };
  const out = google.replyMessagesInThread(thread, { ownEmail: 'mike@marathongroupllc.com', seen: new Set(['m3']) });
  assert.deepStrictEqual(out.map((m) => m.id), ['m2']);
  assert.strictEqual(out[0].text, 'Sure, send me info.');
  assert.strictEqual(out[0].from, 'jane@example.com');

  const all = google.replyMessagesInThread(thread, { ownEmail: 'mike@marathongroupllc.com' });
  assert.deepStrictEqual(all.map((m) => m.id), ['m2', 'm3']);
  assert.strictEqual(all[1].text, 'Thanks!\nCall me');
});

test('exchangeCode posts the code to the token endpoint through the mock client', async () => {
  const calls = [];
  google.setHttp(async (url, init) => {
    calls.push({ url, body: Object.fromEntries(new URLSearchParams(init.body)) });
    return { ok: true, status: 200, json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: google.SCOPES.join(' ') }) };
  });
  try {
    const t = await google.exchangeCode('the-code');
    assert.strictEqual(t.refresh_token, 'r');
    assert.strictEqual(calls[0].url, 'https://oauth2.googleapis.com/token');
    assert.strictEqual(calls[0].body.grant_type, 'authorization_code');
    assert.strictEqual(calls[0].body.code, 'the-code');
    assert.strictEqual(calls[0].body.client_secret, 'test-secret');
  } finally {
    google.setHttp(null);
  }
});

test('token endpoint errors surface without the secret', async () => {
  google.setHttp(async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant', error_description: 'Bad Request' }) }));
  try {
    await assert.rejects(google.refreshAccessToken('r'), (err) => {
      assert.match(err.message, /invalid_grant/);
      assert.ok(!err.message.includes('test-secret'));
      return true;
    });
  } finally {
    google.setHttp(null);
  }
});
