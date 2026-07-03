import { NextResponse } from 'next/server';
import { updateDraft } from '../../../../../lib/queries';

export async function PUT(request, { params }) {
  const { id } = await params;
  const { subject, body } = await request.json().catch(() => ({}));

  if (typeof subject !== 'string' || typeof body !== 'string') {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 });
  }

  try {
    const draft = await updateDraft(id, { subject, body });
    if (!draft) {
      return NextResponse.json({ error: 'No draft exists for this prospect' }, { status: 404 });
    }
    return NextResponse.json(draft);
  } catch (err) {
    console.error(`PUT /api/prospects/${id}/draft failed:`, err);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}
