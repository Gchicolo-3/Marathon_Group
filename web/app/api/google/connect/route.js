import { NextResponse } from 'next/server';
import { isConfigured, missingConfig, newState, authUrl, STATE_COOKIE } from '../../../../lib/google';

// Step one of Connect Gmail: send the browser to Google's consent screen.
// Behind the dashboard login (middleware). The state value is also set as
// a short lived cookie so the callback can reject a forged redirect.
export async function GET(request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: `Gmail is not configured. Add ${missingConfig().join(', ')} in Vercel, then redeploy.` },
      { status: 503 }
    );
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
