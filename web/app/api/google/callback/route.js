import { NextResponse } from 'next/server';
import { connectWithCode, STATE_COOKIE } from '../../../../lib/google';
import { COOKIE_NAME, sessionToken, isValidSession, SESSION_MAX_AGE } from '../../../../lib/auth';
import { isAllowedEmail } from '../../../../lib/signin';
import { ensureSchema } from '../../../../lib/schema';

export const maxDuration = 60;

// Google sends the browser back here after Sign in with Google (from
// /login) or Connect Gmail (from /start or /settings). One step does both:
// the Gmail account is connected for sending, and if the person was not
// signed in yet, the session cookie is set.
//
// Someone not signed in must be on ALLOWED_EMAILS. Someone already signed
// in with the password (George) may connect any account, for testing.
export async function GET(request) {
  const url = request.nextUrl;
  const already = await isValidSession(request.cookies.get(COOKIE_NAME)?.value);

  const go = (path, params = {}) => {
    const dest = url.clone();
    dest.pathname = path;
    dest.search = '';
    for (const [k, v] of Object.entries(params)) if (v) dest.searchParams.set(k, String(v).slice(0, 200));
    const res = NextResponse.redirect(dest);
    res.cookies.set(STATE_COOKIE, '', { path: '/api/google', maxAge: 0 });
    return res;
  };
  const fail = (detail) => (already ? go('/settings', { gmail: 'error', detail }) : go('/login', { error: detail }));

  const error = url.searchParams.get('error');
  if (error) return fail(error === 'access_denied' ? 'You cancelled on the Google screen.' : error);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) {
    return fail('The sign in check expired. Tap the Google button again.');
  }

  try {
    await ensureSchema();
    const { email } = await connectWithCode(code, {
      authorize: async (address) => {
        if (!already && !isAllowedEmail(address)) {
          throw new Error(`${address} is not set up for this account. Ask George to add it.`);
        }
      },
    });
    const res = go('/start', { gmail: 'connected', detail: email });
    if (!already) {
      res.cookies.set(COOKIE_NAME, await sessionToken(), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      });
    }
    return res;
  } catch (err) {
    console.error('Google sign in failed:', err.message);
    return fail(err.message);
  }
}
