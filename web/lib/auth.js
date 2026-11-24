// Google sign in session. The cookie is "<payload>.<signature>" where the
// payload is base64url JSON { e: email, x: expiry ms } and the signature is
// an HMAC-SHA256 keyed by SESSION_SECRET (falls back to TOKEN_ENC_KEY, which
// is already set wherever Google sign in works). Every request re-checks the
// email against ALLOWED_EMAILS, so removing an address in Vercel locks that
// person out on their next click. There is no shared password any more.
// Uses Web Crypto so it runs in both middleware (edge) and route handlers.
import { isAllowedEmail } from './signin.js';

export const COOKIE_NAME = 'marathon_session';
// 90 days: Mike should not be bounced to the login screen every month.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90;

const enc = new TextEncoder();

function secret() {
  const s = (process.env.SESSION_SECRET || process.env.TOKEN_ENC_KEY || '').trim();
  if (s.length < 24) throw new Error('SESSION_SECRET (or TOKEN_ENC_KEY) is not set');
  return 'marathon-session-v2:' + s;
}

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function sign(payload) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Cookie value for a signed in, allowed address.
export async function sessionFor(email) {
  const payload = b64url(enc.encode(JSON.stringify({ e: String(email).toLowerCase(), x: Date.now() + SESSION_MAX_AGE * 1000 })));
  return `${payload}.${await sign(payload)}`;
}

// Returns the signed in email, or null.
export async function sessionEmail(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return null;
  try {
    const [payload, sig] = cookieValue.split('.');
    if (!safeEqual(sig, await sign(payload))) return null;
    const { e, x } = JSON.parse(fromB64url(payload));
    if (!e || !x || Date.now() > x) return null;
    return isAllowedEmail(e) ? e : null;
  } catch {
    return null;
  }
}

export async function isValidSession(cookieValue) {
  return (await sessionEmail(cookieValue)) !== null;
}

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_MAX_AGE };
}
