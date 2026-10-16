import { NextResponse } from 'next/server';
import { getStatus, disconnect } from '../../../../lib/google';

// GET    -> { connected, configured, email?, connected_at?, missing? }  (never tokens)
// DELETE -> forget the connected account
export async function GET() {
  return NextResponse.json(await getStatus());
}

export async function DELETE() {
  try {
    await disconnect();
    return NextResponse.json({ connected: false });
  } catch (err) {
    console.error('gmail disconnect failed:', err.message);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
