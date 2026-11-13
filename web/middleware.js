import { NextResponse } from 'next/server';
import { COOKIE_NAME, isValidSession } from './lib/auth';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Login page and login endpoint stay open. Cron endpoints authenticate
  // with CRON_SECRET inside the route (Vercel Cron has no session cookie).
  if (
    pathname === '/login' ||
    // Public pages Google requires for the OAuth consent screen.
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/api/login' ||
    pathname.startsWith('/api/cron/') ||
    // Sign in with Google starts and finishes here before there is a session.
    // The callback enforces ALLOWED_EMAILS itself.
    pathname === '/api/google/connect' ||
    pathname === '/api/google/callback'
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (await isValidSession(cookie)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
