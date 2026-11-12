// Google OAuth + Gmail API for the connected sender account.
//
// One account is connected at a time (Mike's). Tokens live in gmail_accounts
// encrypted with TOKEN_ENC_KEY, see lib/token-crypto.js. Nothing in this file
// logs a token. All HTTP goes through `http` so tests can swap in a mock.
//
// Pure helpers (buildMime, extractText, replyMessagesInThread) have no I/O
// and are unit tested in scripts/test-gmail.js.
const crypto = require('crypto');
const db = require('./db');
const { encrypt, decrypt } = require('./token-crypto');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const STATE_COOKIE = 'google_oauth_state';

// Swappable for tests: setHttp(async (url, init) => Response-like)
let http = (...args) => fetch(...args);
function setHttp(fn) { http = fn || ((...args) => fetch(...args)); }

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI && process.env.TOKEN_ENC_KEY);
}

function missingConfig() {
  return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'TOKEN_ENC_KEY']
    .filter((k) => !process.env[k]);
}

/* ------------------------------- OAuth -------------------------------- */

function newState() {
  return crypto.randomBytes(16).toString('base64url');
}

function authUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

async function tokenRequest(params) {
  const res = await http(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      ...params,
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Google's error bodies carry no secrets ("invalid_grant" etc.).
    throw new Error(`Google token endpoint ${res.status}: ${data.error || 'unknown'} ${data.error_description || ''}`.trim());
  }
  return data;
}

// Authorization code -> tokens. Returns { access_token, refresh_token, expires_in, scope }.
function exchangeCode(code) {
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: process.env.GOOGLE_REDIRECT_URI });
}

function refreshAccessToken(refreshToken) {
  return tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
}

/* ------------------------------ accounts ------------------------------ */

// Completes a connection: exchanges the code, checks the scopes Google
// actually granted, looks up the mailbox address, and stores the tokens.
// Only one account is kept; connecting a new one replaces the old.
async function connectWithCode(code) {
  const tokens = await exchangeCode(code);
  const granted = (tokens.scope || '').split(/\s+/);
  const missing = SCOPES.filter((s) => !granted.includes(s));
  if (missing.length) {
    throw new Error('Google did not grant the Gmail send and read permissions. Click Connect again and tick both boxes.');
  }
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and connect again.');
  }

  const profile = await gmailFetch(tokens.access_token, '/profile');
  const email = (profile.emailAddress || '').toLowerCase();
  if (!email) throw new Error('Could not read the mailbox address');

  const expiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000);
  await db.query(`DELETE FROM gmail_accounts WHERE email <> $1`, [email]);
  await db.query(
    `INSERT INTO gmail_accounts (email, refresh_token_enc, access_token_enc, expires_at, connected_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (email) DO UPDATE
       SET refresh_token_enc = EXCLUDED.refresh_token_enc,
           access_token_enc = EXCLUDED.access_token_enc,
           expires_at = EXCLUDED.expires_at,
           connected_at = now()`,
    [email, encrypt(tokens.refresh_token), encrypt(tokens.access_token), expiresAt]
  );
  return { email };
}

// Public shape for the UI. Never includes tokens. Returns null when the
// table does not exist yet (migration 006 not run) or nothing is connected.
async function getStatus() {
  if (!isConfigured()) return { connected: false, configured: false, missing: missingConfig() };
  try {
    const r = await db.query(`SELECT email, connected_at FROM gmail_accounts ORDER BY connected_at DESC LIMIT 1`);
    const row = r.rows[0];
    return row
      ? { connected: true, configured: true, email: row.email, connected_at: row.connected_at }
      : { connected: false, configured: true };
  } catch (err) {
    console.error('gmail status:', err.message);
    return { connected: false, configured: true, error: 'Run migration 006 first' };
  }
}

async function isConnected() {
  return (await getStatus()).connected === true;
}

async function disconnect() {
  await db.query(`DELETE FROM gmail_accounts`);
}

// Returns { email, accessToken }, refreshing (and persisting) when the
// stored access token has under a minute left.
async function getAccount() {
  if (!isConfigured()) throw new Error(`Gmail is not configured: set ${missingConfig().join(', ')}`);
  const r = await db.query(
    `SELECT id, email, refresh_token_enc, access_token_enc, expires_at
     FROM gmail_accounts ORDER BY connected_at DESC LIMIT 1`
  );
  const row = r.rows[0];
  if (!row) throw new Error('Gmail is not connected');

  const fresh = row.access_token_enc && row.expires_at &&
    new Date(row.expires_at).getTime() - Date.now() > 60 * 1000;
  if (fresh) return { email: row.email, accessToken: decrypt(row.access_token_enc) };

  const t = await refreshAccessToken(decrypt(row.refresh_token_enc));
  const expiresAt = new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000);
  await db.query(
    `UPDATE gmail_accounts SET access_token_enc = $2, expires_at = $3 WHERE id = $1`,
    [row.id, encrypt(t.access_token), expiresAt]
  );
  return { email: row.email, accessToken: t.access_token };
}

/* ------------------------------ Gmail API ----------------------------- */

async function gmailFetch(accessToken, path, init = {}) {
  const res = await http(`${GMAIL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || data.error || `HTTP ${res.status}`;
    const err = new Error(`Gmail API ${path} ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function encodeHeaderWord(s) {
  // RFC 2047 for non-ASCII subjects / names.
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function newMessageId(fromEmail) {
  const domain = (fromEmail.split('@')[1] || 'marathon.local').toLowerCase();
  return `<${crypto.randomUUID()}@${domain}>`;
}

// RFC 2822 message, text/plain. Returns { raw (base64url), messageId }.
function buildMime({ from, fromName, to, toName, subject, body, inReplyTo, references, messageId }) {
  const id = messageId || newMessageId(from);
  const fromHeader = fromName ? `${encodeHeaderWord(fromName)} <${from}>` : from;
  const toHeader = toName ? `${encodeHeaderWord(toName)} <${to}>` : to;
  const lines = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${encodeHeaderWord(subject || '')}`,
    `Message-ID: ${id}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  const text = Buffer.from((body || '').replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64');
  const mime = `${lines.join('\r\n')}\r\n\r\n${text.match(/.{1,76}/g)?.join('\r\n') || ''}\r\n`;
  return { raw: Buffer.from(mime, 'utf8').toString('base64url'), messageId: id };
}

// Sends through users.messages.send. Returns { id, threadId, messageId } where
// id/threadId are Gmail's and messageId is the RFC Message-ID header.
async function sendMail({ to, toName, subject, body, inReplyTo, references, threadId }) {
  const { email, accessToken } = await getAccount();
  const { raw, messageId } = buildMime({ from: email, to, toName, subject, body, inReplyTo, references });
  const payload = threadId ? { raw, threadId } : { raw };
  const sent = await gmailFetch(accessToken, '/messages/send', { method: 'POST', body: JSON.stringify(payload) });
  return { id: sent.id, threadId: sent.threadId, messageId, from: email };
}

async function getThread(threadId) {
  const { email, accessToken } = await getAccount();
  const thread = await gmailFetch(accessToken, `/threads/${encodeURIComponent(threadId)}?format=full`);
  return { thread, ownEmail: email };
}

/* ---------------------------- thread parsing --------------------------- */

function header(message, name) {
  const h = (message.payload?.headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function decodeBody(data) {
  return data ? Buffer.from(data, 'base64url').toString('utf8') : '';
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Plain text of a message: first text/plain part, else stripped text/html.
function extractText(message) {
  let plain = '', html = '';
  const walk = (part) => {
    if (!part) return;
    const mime = part.mimeType || '';
    if (mime === 'text/plain' && part.body?.data && !plain) plain = decodeBody(part.body.data);
    else if (mime === 'text/html' && part.body?.data && !html) html = decodeBody(part.body.data);
    (part.parts || []).forEach(walk);
  };
  walk(message.payload);
  return (plain || stripHtml(html)).trim();
}

// Drops the quoted original from a reply so the classifier sees only the
// new text. Conservative: only cuts at the usual "On ... wrote:" line or a
// run of quoted lines.
function newTextOnly(text) {
  const lines = text.split('\n');
  const cut = lines.findIndex((l, i) =>
    /^On .{6,200}wrote:\s*$/.test(l.trim()) ||
    /^-{2,}\s*Original Message\s*-{2,}$/i.test(l.trim()) ||
    (l.trim().startsWith('>') && i > 0 && lines.slice(i, i + 3).every((x) => x.trim().startsWith('>') || x.trim() === ''))
  );
  return (cut > 0 ? lines.slice(0, cut) : lines).join('\n').trim();
}

function addressOf(headerValue) {
  const m = /<([^>]+)>/.exec(headerValue || '');
  return (m ? m[1] : headerValue || '').trim().toLowerCase();
}

// Messages in a thread that are replies to us: not sent by the connected
// account, not in a seen set, and newer than `afterMs` (the intro's send
// time, when known). Each item: { id, threadId, from, date, text }.
function replyMessagesInThread(thread, { ownEmail, seen = new Set(), afterMs = 0 } = {}) {
  const own = (ownEmail || '').toLowerCase();
  const out = [];
  for (const m of thread.messages || []) {
    if (!m || seen.has(m.id)) continue;
    if ((m.labelIds || []).includes('SENT') || (m.labelIds || []).includes('DRAFT')) continue;
    const from = addressOf(header(m, 'From'));
    if (own && from === own) continue;
    const date = Number(m.internalDate) || 0;
    if (afterMs && date && date < afterMs) continue;
    out.push({ id: m.id, threadId: m.threadId, from, date, text: newTextOnly(extractText(m)) });
  }
  return out.sort((a, b) => a.date - b.date);
}

module.exports = {
  SCOPES, STATE_COOKIE, isConfigured, missingConfig, setHttp,
  newState, authUrl, exchangeCode, refreshAccessToken,
  connectWithCode, getStatus, isConnected, disconnect, getAccount,
  buildMime, sendMail, getThread,
  extractText, newTextOnly, replyMessagesInThread,
};
