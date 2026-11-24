import { NextResponse } from 'next/server';
import { connectWithCode, redirectUriFor, STATE_COOKIE } from '../../../../lib/google';
import { COOKIE_NAME, sessionFor, sessionCookieOptions } from '../../../../lib/auth';
import { isAllowedEmail, allowedEmails } from '../../../../lib/signin';
import { ensureSchema } from '../../../../lib/schema';

export const maxDuration = 60;

const MODE_COOKIE = 'google_oauth_mode';

// Google sends the browser back here after Sign in with Google (from /login)
// or Connect Gmail (from /start or /settings). The Google account must be on
// ALLOWED_EMAILS or nothing is stored and no session is set.
//
// The mailbox used for sending is replaced only when: nothing is connected
// yet, the person signing in is the owner (first address on ALLOWED_EMAILS,
// i.e. Mike), or they pressed a Connect Gmail button. So George signing in to
// check on things never knocks Mike's Gmail off.
export async function GET(request) {
  const url = request.nextUrl;

  const go = (path, params = {}) => {
    const dest = url.clone();
    dest.pathname = path;
    dest.search = '';
    for (const [k, v] of Object.entries(params)) if (v) dest.searchParams.set(k, String(v).slice(0, 200));
    const res = NextResponse.redirect(dest);
    res.cookies.set(STATE_COOKIE, '', { path: '/api/google', maxAge: 0 });
    res.cookies.set(MODE_COOKIE, '', { path: '/api/google', maxAge: 0 });
    return res;
  };
  const fail = (detail) => go('/login', { error: detail });

  const error = url.searchParams.get('error');
  if (error) return fail(error === 'access_denied' ? 'You cancelled on the Google screen.' : 'Google did not finish the sign in. Try again.');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) {
    return fail('The sign in check expired. Tap the Google button again.');
  }
  const mode = request.cookies.get(MODE_COOKIE)?.value === 'gmail' ? 'gmail' : 'signin';
  const owner = allowedEmails()[0];

  try {
    await ensureSchema();
    const result = await connectWithCode(code, {
      redirectUri: redirectUriFor(url.origin),
      authorize: async (address) => {
        if (!isAllowedEmail(address)) {
          const err = new Error(`${address} does not have access to this dashboard. Sign in with the Google account George set up for you.`);
          err.refused = true;
          throw err;
        }
      },
      keepExisting: (address) => mode !== 'gmail' && address !== owner,
    });
    const res = go(result.connected ? '/start' : '/keep-warm', result.connected ? { gmail: 'connected', detail: result.email } : {});
    res.cookies.set(COOKIE_NAME, await sessionFor(result.email), sessionCookieOptions());
    return res;
  } catch (err) {
    console.error('Google sign in failed:', err.refused ? 'address not on ALLOWED_EMAILS' : err.message);
    return fail(err.refused ? err.message : 'Sign in did not finish. Try again, and tick both Gmail boxes on the Google screen.');
  }
}
