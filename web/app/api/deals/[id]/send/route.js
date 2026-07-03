import { NextResponse } from 'next/server';
import { getDeal, setDraftStatus, logActivity } from '../../../../../lib/queries';

// v1 send: mark the latest draft sent, log an email_sent activity, and hand
// the client a mailto: link with the approved subject/body pre-filled.
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const deal = await getDeal(id);
    if (!deal || deal.draft_id == null) {
      return NextResponse.json({ error: 'No draft exists for this deal' }, { status: 404 });
    }
    if (deal.draft_status !== 'approved') {
      return NextResponse.json({ error: 'Draft must be approved before sending' }, { status: 409 });
    }

    const draft = await setDraftStatus(id, 'sent');
    await logActivity(id, 'email_sent', `Email sent: "${draft.subject}"`);

    const to = deal.contact_email ? encodeURIComponent(deal.contact_email) : '';
    const qs = new URLSearchParams({ subject: draft.subject || '', body: draft.body || '' });
    // URLSearchParams encodes spaces as '+', which mail clients render
    // literally — use %20 instead.
    const mailto = `mailto:${to}?${qs.toString().replace(/\+/g, '%20')}`;

    return NextResponse.json({ ...draft, mailto });
  } catch (err) {
    console.error(`POST /api/deals/${id}/send failed:`, err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
