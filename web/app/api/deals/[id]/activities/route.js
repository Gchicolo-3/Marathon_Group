import { NextResponse } from 'next/server';
import { getDeal, listActivities } from '../../../../../lib/queries';

export const dynamic = 'force-dynamic';

// Full activity timeline for a deal, newest first.
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const deal = await getDeal(id);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(await listActivities(id));
  } catch (err) {
    console.error(`GET /api/deals/${id}/activities failed:`, err);
    return NextResponse.json({ error: 'Failed to load activities' }, { status: 500 });
  }
}
