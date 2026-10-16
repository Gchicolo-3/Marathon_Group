// Gmail connection for the Marathon instance. Plain fetch against Google's
// OAuth and Gmail REST endpoints, no SDK. One connected mailbox (Mike's).
//   connect  -> authUrl() / exchangeCode()
//   send     -> sendEmail()      (from the connected mailbox)
//   replies  -> checkReplies()   (calls recordReply, the one billing entry point)
const crypto = require('crypto');
const db = require('./db');
const { encrypt, decrypt } = require('./crypto');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI && process.env.TOKEN_ENC_KEY);
}

function authUrl(state) {
  const p = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: env('GOOGLE_REDIRECT_URI'),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      ...params,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google token error: ${data.error_description || data.error || res.status}`);
  return data;
}

async function gmailGet(path, accessToken) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gmail ${path.split('?')[0]} ${res.status}: ${data.error?.message || ''}`);
  return data;
}

async function exchangeCode(code) {
  const t = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: env('GOOGLE_REDIRECT_URI') });
  if (!t.refresh_token) {
    throw new Error('Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and connect again.');
  }
  const profile = await gmailGet('/profile', t.access_token);
  const email = profile.emailAddress;
  const expires = new Date(Date.now() + (t.expires_in || 3600) * 1000);
  await db.query(
    `INSERT INTO gmail_accounts (email, refresh_token_enc, access_token_enc, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET refresh_token_enc = EXCLUDED.refresh_token_enc,
       access_token_enc = EXCLUDED.access_token_enc, expires_at = EXCLUDED.expires_at, connected_at = now()`,
    [email, encrypt(t.refresh_token), encrypt(t.access_token), expires]
  );
  return { email };
}

async function getAccount() {
  const r = await db.query(`SELECT * FROM gmail_accounts ORDER BY connected_at DESC LIMIT 1`);
  return r.rows[0] || null;
}

// A fresh access token for the connected mailbox, refreshing when needed.
async function accessToken(account) {
  const exp = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (account.access_token_enc && exp - Date.now() > 60000) return decrypt(account.access_token_enc);
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(account.refresh_token_enc) });
  await db.query(
    `UPDATE gmail_accounts SET access_token_enc = $2, expires_at = $3 WHERE id = $1`,
    [account.id, encrypt(t.access_token), new Date(Date.now() + (t.expires_in || 3600) * 1000)]
  );
  return t.access_token;
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const mimeWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);

function buildRaw({ from, to, subject, body }) {
  const clean = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();
  const lines = [
    `From: ${clean(from)}`,
    `To: ${clean(to)}`,
    `Subject: ${mimeWord(clean(subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(String(body || '').replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
  ];
  return b64url(lines.join('\r\n'));
}

// Sends one email from the connected mailbox. Returns { id, threadId, from }.
async function sendEmail({ to, subject, body }) {
  const account = await getAccount();
  if (!account) throw new Error('Gmail is not connected');
  const token = await accessToken(account);
  const res = await fetch(`${API}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: buildRaw({ from: account.email, to, subject, body }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gmail send failed (${res.status}): ${data.error?.message || ''}`);
  return { id: data.id, threadId: data.threadId, from: account.email };
}

function header(msg, name) {
  const h = (msg.payload?.headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function plainText(part) {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  }
  for (const p of part.parts || []) {
    const t = plainText(p);
    if (t) return t;
  }
  return '';
}

// Drops the quoted history so the classifier reads only what they wrote.
function stripQuoted(text) {
  const cut = text.search(/\r?\n(On .{5,120} wrote:|-{2,}\s*Original Message|From: .+\r?\nSent:)/i);
  return (cut > 0 ? text.slice(0, cut) : text).trim().slice(0, 4000);
}

// Looks at every sent deal with a Gmail thread and feeds any new message
// from the other side into recordReply. Safe to run repeatedly: each deal
// keeps a high water mark (gmail_last_ms) so a message is only read once.
async function checkReplies({ limit = 40 } = {}) {
  const account = await getAccount();
  if (!account) return { connected: false, checked: 0, replies: 0 };
  const { classifyReply, recordReply } = require('./replies');
  const token = await accessToken(account);
  const mine = account.email.toLowerCase();

  const deals = await db.query(
    `SELECT id, gmail_thread_id, gmail_last_ms FROM deals
     WHERE gmail_thread_id IS NOT NULL AND stage IN ('contacted','replied')
     ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );
  let replies = 0;
  const errors = [];
  for (const d of deals.rows) {
    try {
      const thread = await gmailGet(`/threads/${d.gmail_thread_id}?format=full`, token);
      const since = Number(d.gmail_last_ms || 0);
      let high = since;
      const fresh = (thread.messages || [])
        .filter((m) => Number(m.internalDate) > since && !header(m, 'From').toLowerCase().includes(mine))
        .sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
      for (const m of fresh) {
        const text = stripQuoted(plainText(m.payload)) || m.snippet || '';
        const from = header(m, 'From');
        const cls = /mailer-daemon|postmaster/i.test(from)
          ? { classification: 'bounce', reason: 'delivery failure notice' }
          : await classifyReply(text);
        await recordReply(d.id, { text, classification: cls.classification, reason: cls.reason });
        replies += 1;
        high = Math.max(high, Number(m.internalDate));
      }
      if (high > since) await db.query(`UPDATE deals SET gmail_last_ms = $2 WHERE id = $1`, [d.id, high]);
    } catch (err) {
      errors.push(`deal ${d.id}: ${err.message}`);
    }
  }
  return { connected: true, checked: deals.rows.length, replies, errors };
}

module.exports = {
  isConfigured, authUrl, exchangeCode, getAccount, sendEmail, checkReplies,
  buildRaw, stripQuoted, plainText, SCOPES,
};
