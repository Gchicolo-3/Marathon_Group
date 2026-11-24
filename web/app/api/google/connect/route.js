import { NextResponse } from 'next/server';
import { isConfigured, missingConfig, newState, authUrl, redirectUriFor, STATE_COOKIE } from '../../../../lib/google';

const MODE_COOKIE = 'google_oauth_mode';

// Step one of Sign in with Google / Connect Gmail: send the browser to
// Google's consent screen. Open without a session (see middleware). The state
// value is also set as a short lived cookie so the callback can reject a
// forged redirect. ?mode=gmail (the Connect Gmail buttons) means "make this
// the sending mailbox even if another one is connected".
export async function GET(request) {
  if (!isConfigured()) {
    const dest = request.nextUrl.clone();
    dest.pathname = '/login';
    dest.search = '';
    dest.searchParams.set('error', 'Google sign in is not switched on yet. Ask George to finish setup.');
    console.error('Google sign in not configured, missing:', missingConfig().join(', '));
    return NextResponse.redirect(dest);
  }
  const state = newState();
  const res = NextResponse.redirect(authUrl(state, redirectUriFor(request.nextUrl.origin)));
  const opts = { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/api/google', maxAge: 10 * 60 };
  res.cookies.set(STATE_COOKIE, state, opts);
  res.cookies.set(MODE_COOKIE, request.nextUrl.searchParams.get('mode') === 'gmail' ? 'gmail' : 'signin', opts);
  return res;
}
