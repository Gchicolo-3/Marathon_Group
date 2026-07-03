import { NextResponse } from 'next/server';
import { setDraftStatus } from '../../../../../lib/queries';

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const draft = await setDraftStatus(id, 'approved');
    if (!draft) {
      return NextResponse.json({ error: 'No draft exists for this prospect' }, { status: 404 });
    }
    return NextResponse.json(draft);
  } catch (err) {
    console.error(`POST /api/prospects/${id}/approve failed:`, err);
    return NextResponse.json({ error: 'Failed to approve draft' }, { status: 500 });
  }
}
