import { NextResponse } from 'next/server';
import { isConfigured, getAccount } from '../../../../lib/gmail';

export async function GET() {
  const configured = isConfigured();
  try {
    const account = configured ? await getAccount() : null;
    return NextResponse.json({
      configured,
      connected: !!account,
      email: account?.email || null,
      connected_at: account?.connected_at || null,
    });
  } catch (err) {
    // Table missing until migration 006 runs.
    return NextResponse.json({ configured, connected: false, email: null, needs_migration: true });
  }
}
