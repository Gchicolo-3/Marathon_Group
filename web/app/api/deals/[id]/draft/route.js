import { NextResponse } from 'next/server';
import { updateDraft } from '../../../../../lib/queries';

// Save edited subject/body on the deal's latest draft; stamps edited_at.
export async function PUT(request, { params }) {
  const { id } = await params;
  const { subject, body } = await request.json().catch(() => ({}));

  if (typeof subject !== 'string' || typeof body !== 'string') {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 });
  }

  try {
    const draft = await updateDraft(id, { subject, body });
    if (!draft) return NextResponse.json({ error: 'No draft exists for this deal' }, { status: 404 });
    return NextResponse.json(draft);
  } catch (err) {
    console.error(`PUT /api/deals/${id}/draft failed:`, err);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}
