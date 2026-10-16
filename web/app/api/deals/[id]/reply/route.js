import { NextResponse } from 'next/server';
import { recordReply } from '../../../../../lib/replies';

export const maxDuration = 60;

// POST { text }                       -> classify the pasted reply and record it
// POST { text, classification }       -> record with a human-chosen class
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body.text && !body.classification) {
    return NextResponse.json({ error: 'Paste the reply text or choose a classification' }, { status: 400 });
  }
  try {
    const result = await recordReply(id, body);
    if (!result) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error(`POST /api/deals/${id}/reply failed:`, err);
    return NextResponse.json({ error: 'Failed to record reply' }, { status: 500 });
  }
}
