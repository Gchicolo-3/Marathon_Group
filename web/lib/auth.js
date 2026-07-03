// Shared-password gate. The session cookie holds an HMAC of a fixed string
// keyed by DASHBOARD_PASSWORD, so changing the password invalidates sessions.
// Uses Web Crypto so it runs in both middleware (edge) and route handlers.
const COOKIE_NAME = 'marathon_auth';
const TOKEN_PAYLOAD = 'marathon-crm-dashboard-v1';

async function sessionToken() {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) throw new Error('DASHBOARD_PASSWORD is not set');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(TOKEN_PAYLOAD));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function isValidSession(cookieValue) {
  if (!cookieValue) return false;
  try {
    return cookieValue === (await sessionToken());
  } catch {
    return false;
  }
}

module.exports = { COOKIE_NAME, sessionToken, isValidSession };
