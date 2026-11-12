import { NextResponse } from 'next/server';
import { isConfigured, missingConfig, newState, authUrl, STATE_COOKIE } from '../../../../lib/google';

// Step one of Sign in with Google / Connect Gmail: send the browser to
// Google's consent screen. Open without a session (see middleware). The state value is also set as
// a short lived cookie so the callback can reject a forged redirect.
export async function GET(request) {
  if (!isConfigured()) {
    const dest = request.nextUrl.clone();
    dest.pathname = '/login';
    dest.search = '';
    dest.searchParams.set('error', `Google sign in is not switched on yet (missing ${missingConfig().join(', ')}).`);
    return NextResponse.redirect(dest);
  }
  const state = newState();
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/api/google',
    maxAge: 10 * 60,
  });
  return res;
}
