import { NextResponse } from 'next/server';
import { getProspect, setDraftStatus } from '../../../../../lib/queries';

// v1 send: mark the draft as sent and hand the client a mailto: link with
// the approved subject/body pre-filled. Actual delivery happens in the
// user's mail client.
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const prospect = await getProspect(id);
    if (!prospect || prospect.draft_id == null) {
      return NextResponse.json({ error: 'No draft exists for this prospect' }, { status: 404 });
    }
    if (prospect.draft_status !== 'approved') {
      return NextResponse.json(
        { error: 'Draft must be approved before sending' },
        { status: 409 }
      );
    }

    const draft = await setDraftStatus(id, 'sent');

    const to = prospect.email ? encodeURIComponent(prospect.email) : '';
    const qs = new URLSearchParams({
      subject: draft.subject || '',
      body: draft.body || '',
    });
    // URLSearchParams encodes spaces as '+', which mail clients render
    // literally — use %20 instead.
    const mailto = `mailto:${to}?${qs.toString().replace(/\+/g, '%20')}`;

    return NextResponse.json({ ...draft, mailto });
  } catch (err) {
    console.error(`POST /api/prospects/${id}/send failed:`, err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
