import { NextResponse } from 'next/server';
import { COOKIE_NAME, isValidSession } from './lib/auth';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Login page and login endpoint stay open.
  if (pathname === '/login' || pathname === '/api/login') {
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
