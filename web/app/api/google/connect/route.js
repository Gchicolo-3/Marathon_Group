import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { authUrl, isConfigured } from '../../../../lib/gmail';

// Starts the Google consent flow. Behind the dashboard login.
export async function GET(request) {
  if (!isConfigured()) {
    return NextResponse.redirect(new URL('/runs?gmail=not_configured', request.nextUrl));
  }
  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set('gmail_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  });
  return res;
}
