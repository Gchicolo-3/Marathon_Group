import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';
import { getDeal, setDraftStatus, setDealStage, logActivity } from '../../../../../lib/queries';
import { passesGate } from '../../../../../lib/enrich';
import { isConnected, sendMail } from '../../../../../lib/google';

export const maxDuration = 60;

// Send the approved draft.
//
// Gmail connected: send it through the Gmail API from the connected
// account, save the Message-ID / threadId on the deal, log email_sent
// (which is what the follow-up sequence clocks from), and move the deal to
// Contacted. Follow-ups go out in the same thread as the intro.
//
// Gmail not connected: v1 behavior, mark sent and hand back a mailto: link.
//
// Same email gate as Approve: no send to an unverified address, even if
// the draft was approved before the status changed.
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
          error: 'Email is not verified yet. Verify it (or confirm it by hand) before sending.',
          code: 'EMAIL_NOT_VERIFIED',
          email_status: deal.contact_email_status || 'unverified',
        },
        { status: 409 }
      );
    }
    if (deal.draft_status !== 'approved') {
      return NextResponse.json({ error: 'Draft must be approved before sending' }, { status: 409 });
    }

    if (await isConnected()) {
      return NextResponse.json(await sendViaGmail(deal));
    }

    const draft = await setDraftStatus(id, 'sent');
    await logActivity(id, 'email_sent', `Email sent: "${draft.subject}"`);

    const to = deal.contact_email ? encodeURIComponent(deal.contact_email) : '';
    const qs = new URLSearchParams({ subject: draft.subject || '', body: draft.body || '' });
    // URLSearchParams encodes spaces as '+', which mail clients render
    // literally — use %20 instead.
    const mailto = `mailto:${to}?${qs.toString().replace(/\+/g, '%20')}`;

    return NextResponse.json({ ...draft, via: 'mailto', mailto });
  } catch (err) {
    console.error(`POST /api/deals/${id}/send failed:`, err.message);
    return NextResponse.json({ error: err.message || 'Failed to send' }, { status: 500 });
  }
}

async function sendViaGmail(deal) {
  if (!deal.contact_email) throw new Error('Contact has no email address');

  const prior = (
    await db.query(`SELECT gmail_message_id, gmail_thread_id FROM deals WHERE id = $1`, [deal.id])
  ).rows[0] || {};

  const sent = await sendMail({
    to: deal.contact_email,
    toName: deal.contact_name,
    subject: deal.draft_subject,
    body: deal.draft_body,
    inReplyTo: prior.gmail_message_id || undefined,
    references: prior.gmail_message_id || undefined,
    threadId: prior.gmail_thread_id || undefined,
  });

  const draft = await setDraftStatus(deal.id, 'sent');
  await db.query(
    `UPDATE email_drafts SET gmail_message_id = $2, sent_at = now() WHERE id = $1`,
    [draft.id, sent.id]
  );
  await db.query(
    `UPDATE deals SET gmail_message_id = $2, gmail_thread_id = $3, updated_at = now() WHERE id = $1`,
    [deal.id, sent.messageId, sent.threadId]
  );
  await db.query(
    `INSERT INTO gmail_messages (gmail_id, deal_id, thread_id, direction)
     VALUES ($1, $2, $3, 'sent') ON CONFLICT (gmail_id) DO NOTHING`,
    [sent.id, deal.id, sent.threadId]
  );
  await logActivity(deal.id, 'email_sent', `Email sent via Gmail from ${sent.from}: "${draft.subject}"`);
  if (['new', 'qualified'].includes(deal.stage)) {
    await setDealStage(deal.id, 'contacted');
  }
  return { ...draft, via: 'gmail', from: sent.from, thread_id: sent.threadId };
}
