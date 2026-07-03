import { NextResponse } from 'next/server';
import { COOKIE_NAME, sessionToken } from '../../../lib/auth';

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));

  if (!process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'DASHBOARD_PASSWORD not configured' }, { status: 500 });
  }
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, await sessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
