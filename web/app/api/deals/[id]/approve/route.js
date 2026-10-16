import { NextResponse } from 'next/server';
import { getDeal, setDraftStatus } from '../../../../../lib/queries';
import { passesGate } from '../../../../../lib/enrich';

// Approve is the human gate. A draft cannot be approved until the contact's
// email is verified (provider says valid) or someone confirmed it by hand.
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const deal = await getDeal(id);
    if (!deal || deal.draft_id == null) {
      return NextResponse.json({ error: 'No draft exists for this deal' }, { status: 404 });
    }
    if (!passesGate(deal.contact_email_status)) {
      return NextResponse.json(
        {
          error: 'Email is not verified yet. Verify it (or confirm it by hand) before approving.',
          code: 'EMAIL_NOT_VERIFIED',
          email_status: deal.contact_email_status || 'unverified',
        },
        { status: 409 }
      );
    }
    const draft = await setDraftStatus(id, 'approved');
    return NextResponse.json(draft);
  } catch (err) {
    console.error(`POST /api/deals/${id}/approve failed:`, err);
    return NextResponse.json({ error: 'Failed to approve draft' }, { status: 500 });
  }
}
