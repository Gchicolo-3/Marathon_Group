import { NextResponse } from 'next/server';
import { connectWithCode, STATE_COOKIE } from '../../../../lib/google';

export const maxDuration = 60;

// Step two of Connect Gmail: Google sends the browser back here with a
// code. Exchange it, store the (encrypted) tokens, bounce to /runs with a
// result flag. Behind the dashboard login, so the person clicking Allow has
// to be signed in to the dashboard in the same browser.
export async function GET(request) {
  const url = request.nextUrl;
  const back = (flag, detail) => {
    const dest = url.clone();
    dest.pathname = '/runs';
    dest.search = '';
    dest.searchParams.set('gmail', flag);
    if (detail) dest.searchParams.set('detail', detail.slice(0, 200));
    const res = NextResponse.redirect(dest);
    res.cookies.set(STATE_COOKIE, '', { path: '/api/google', maxAge: 0 });
    return res;
  };

  const error = url.searchParams.get('error');
  if (error) return back('error', error === 'access_denied' ? 'You cancelled on the Google screen' : error);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) {
    return back('error', 'Sign in check failed. Click Connect Gmail again.');
  }

  try {
    const { email } = await connectWithCode(code);
    return back('connected', email);
  } catch (err) {
    console.error('Gmail connect failed:', err.message);
    return back('error', err.message);
  }
}
