import { NextResponse } from 'next/server';
import { getDeal, logActivity } from '../../../../../lib/queries';

// Add a note to a deal; logged as a note activity.
export async function POST(request, { params }) {
  const { id } = await params;
  const { content } = await request.json().catch(() => ({}));

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  try {
    const deal = await getDeal(id);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    const activity = await logActivity(id, 'note', content.trim());
    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    console.error(`POST /api/deals/${id}/notes failed:`, err);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}
