import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { logAgentRun } from '../../../../lib/queries';
import { classifyReply, recordReply } from '../../../../lib/replies';
import { isConnected, getThread, replyMessagesInThread } from '../../../../lib/google';

export const maxDuration = 300;

const DEALS_PER_RUN = 40;

// Reply reader (every 15 minutes on weekdays, see web/vercel.json). For each
// Contacted deal that went out through Gmail, open its thread and look for
// messages from the contact we have not seen. Each new one goes through
// classifyReply then recordReply, which is the only place first_reply_at
// (the billing trigger) is set, so it fires once no matter how often this
// runs. Our own sent messages are skipped by sender and by the
// gmail_messages table.
export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isConnected())) return NextResponse.json({ skipped: 'gmail not connected' });

  const summary = { checked: 0, replies: 0, positive: 0, errors: [] };
  try {
    const deals = (
      await db.query(
        `SELECT id, gmail_thread_id FROM deals
         WHERE stage = 'contacted' AND gmail_thread_id IS NOT NULL
         ORDER BY gmail_checked_at ASC NULLS FIRST, id
         LIMIT $1`,
        [DEALS_PER_RUN]
      )
    ).rows;

    for (const deal of deals) {
      try {
        const found = await checkDeal(deal);
        summary.replies += found.replies;
        summary.positive += found.positive;
      } catch (err) {
        summary.errors.push(`deal ${deal.id}: ${err.message}`);
      }
      summary.checked++;
      await db.query(`UPDATE deals SET gmail_checked_at = now() WHERE id = $1`, [deal.id]);
    }

    // Only leave a row on /runs when something happened; a quiet check
    // every 15 minutes would bury the real runs.
    if (summary.replies > 0 || summary.errors.length) {
      await logAgentRun({
        run_type: 'reply_check',
        prospects_found: summary.replies,
        errors: summary.errors.length ? summary.errors.join('; ') : null,
      }).catch(() => {});
    }
    return NextResponse.json(summary);
  } catch (err) {
    console.error('Reply cron failed:', err.message);
    await logAgentRun({ run_type: 'reply_check', errors: err.message }).catch(() => {});
    return NextResponse.json({ error: err.message, ...summary }, { status: 500 });
  }
}

async function checkDeal(deal) {
  const out = { replies: 0, positive: 0 };
  const { thread, ownEmail } = await getThread(deal.gmail_thread_id);
  const seen = new Set(
    (await db.query(`SELECT gmail_id FROM gmail_messages WHERE deal_id = $1`, [deal.id])).rows.map((r) => r.gmail_id)
  );

  for (const msg of replyMessagesInThread(thread, { ownEmail, seen })) {
    // Claim the message first; a second run overlapping this one sees the
    // row and skips it.
    const claimed = await db.query(
      `INSERT INTO gmail_messages (gmail_id, deal_id, thread_id, direction)
       VALUES ($1, $2, $3, 'received') ON CONFLICT (gmail_id) DO NOTHING RETURNING gmail_id`,
      [msg.id, deal.id, msg.threadId]
    );
    if (!claimed.rows.length) continue;

    const { classification, reason } = await classifyReply(msg.text);
    const result = await recordReply(deal.id, { text: msg.text, classification, reason });
    out.replies++;
    if (result?.first_positive) out.positive++;
  }
  return out;
}
