import { NextResponse } from 'next/server';
import { listProspects } from '../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const prospects = await listProspects();
    return NextResponse.json(prospects);
  } catch (err) {
    console.error('GET /api/prospects failed:', err);
    return NextResponse.json({ error: 'Failed to load prospects' }, { status: 500 });
  }
}
