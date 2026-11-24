import { NextResponse } from 'next/server';
import { COOKIE_NAME, isValidSession } from './lib/auth.js';

// Phase B (prospecting / outbound) screens. Hidden while Mike is in research
// only mode so his first screens show only his own people. Set
// SHOW_PROSPECTING=1 in Vercel to bring them back for George.
const PHASE_B_PAGES = ['/pipeline', '/queue', '/signals', '/activity', '/companies', '/contacts', '/runs', '/deal'];
const PHASE_B_API = ['/api/deals', '/api/companies', '/api/contacts', '/api/pipeline', '/api/admin'];
const under = (p, base) => p === base || p.startsWith(base + '/');

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Login page stays open. Cron endpoints authenticate with CRON_SECRET
  // inside the route (Vercel Cron has no session cookie). There is no
  // password login: Google sign in is the only way in.
  if (
    pathname === '/login' ||
    // Public pages Google requires for the OAuth consent screen.
    pathname === '/privacy' ||
    pathname === '/terms' ||
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
    if (process.env.SHOW_PROSPECTING !== '1') {
      if (PHASE_B_API.some((b) => under(pathname, b))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (pathname === '/' || PHASE_B_PAGES.some((b) => under(pathname, b))) {
        const home = request.nextUrl.clone();
        home.pathname = '/keep-warm';
        home.search = '';
        return NextResponse.redirect(home);
      }
    }
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
