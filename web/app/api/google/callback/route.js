import { NextResponse } from 'next/server';
import { exchangeCode } from '../../../../lib/gmail';

export const maxDuration = 30;

export async function GET(request) {
  const url = request.nextUrl;
  const back = (flag) => {
    const res = NextResponse.redirect(new URL(`/runs?gmail=${flag}`, url));
    res.cookies.delete('gmail_oauth_state');
    return res;
  };
  if (url.searchParams.get('error')) return back('denied');
  const state = url.searchParams.get('state');
  const saved = request.cookies.get('gmail_oauth_state')?.value;
  const code = url.searchParams.get('code');
  if (!code || !state || !saved || state !== saved) return back('bad_state');
  try {
    await exchangeCode(code);
    return back('connected');
  } catch (err) {
    console.error('gmail callback failed:', err.message);
    return back('error');
  }
}
