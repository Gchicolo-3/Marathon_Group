import { NextResponse } from 'next/server';
import { getDeal, setDraftStatus, logActivity, setDealStage } from '../../../../../lib/queries';
import { passesGate } from '../../../../../lib/enrich';
import db from '../../../../../lib/db';
import { getAccount, sendEmail } from '../../../../../lib/gmail';

// Send. With Gmail connected the email goes out from the connected mailbox
// and the deal moves to contacted. Without it, falls back to the v1 behavior:
// mark sent and hand the client a mailto: link. Either way the verified
// email gate applies, so nothing goes to an unverified address.
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

    if (!passesGate(deal.contact_email_status)) {
      return NextResponse.json(
        { error: 'Email is not verified yet.', code: 'EMAIL_NOT_VERIFIED' },
        { status: 409 }
      );
    }
    if (!deal.contact_email) {
      return NextResponse.json({ error: 'This contact has no email address' }, { status: 409 });
    }

    let account = null;
    try { account = await getAccount(); } catch { account = null; }
    if (account) {
      const sent = await sendEmail({ to: deal.contact_email, subject: deal.draft_subject, body: deal.draft_body });
      const draft = await setDraftStatus(id, 'sent');
      await db.query(
        `UPDATE deals SET gmail_thread_id = $2, gmail_message_id = $3, gmail_last_ms = $4, sent_via = 'gmail', updated_at = now() WHERE id = $1`,
        [id, sent.threadId, sent.id, Date.now()]
      );
      await logActivity(id, 'email_sent', `Email sent from ${sent.from}: "${draft.subject}"`);
      if (deal.stage === 'qualified' || deal.stage === 'new') await setDealStage(id, 'contacted');
      return NextResponse.json({ ...draft, sent_via: 'gmail', from: sent.from });
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
