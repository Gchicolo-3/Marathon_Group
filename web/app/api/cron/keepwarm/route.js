import { NextResponse } from 'next/server';
import { ensureSchema } from '../../../../lib/schema';
import { createWeeklyTouches, sendWeeklyDigest } from '../../../../lib/keepwarm';
import { logAgentRun } from '../../../../lib/queries';

export const maxDuration = 300;

// Sunday morning (see web/vercel.json): write notes for whoever is due this
// week, then email Mike the list from his own Gmail. Drafts only. Sending
// happens only when he taps Send.
export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await ensureSchema();
    const touches = await createWeeklyTouches();
    const digest = await sendWeeklyDigest().catch((err) => ({ sent: false, error: err.message }));
    await logAgentRun({
      run_type: 'keep_warm',
      drafts_created: touches.drafted,
      errors: [...(touches.errors || []), digest.error].filter(Boolean).join('; ') || null,
    }).catch(() => {});
    return NextResponse.json({ touches, digest });
  } catch (err) {
    console.error('keep warm cron failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
