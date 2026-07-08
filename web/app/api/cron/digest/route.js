import { NextResponse } from 'next/server';
import { getDigest, composeBrief, sendDigestEmail } from '../../../../lib/digest';
import { logAgentRun, getPipelineStats } from '../../../../lib/queries';

// Daily digest cron (8 AM ET weekdays, see web/vercel.json). Computes the
// digest, stores the morning brief for the dashboard's "Today's Brief"
// panel, and emails Michael when Resend is configured.
export const maxDuration = 60;

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const digest = await getDigest();
    const delivery = await sendDigestEmail(digest);

    // Morning brief for the dashboard — needs migration 003's notes column,
    // so a failure here never blocks the digest itself.
    const stats = await getPipelineStats().catch(() => ({ signals_week: 0 }));
    const brief = composeBrief(digest, stats.signals_week);
    await logAgentRun({ run_type: 'morning_brief', notes: brief }).catch((err) =>
      console.error('Morning brief not stored:', err.message)
    );

    await logAgentRun({ run_type: 'daily_digest' }).catch(() => {});
    console.log('Digest:', JSON.stringify({ ...digest, delivery }));
    return NextResponse.json({ ...digest, delivery, brief });
  } catch (err) {
    console.error('Digest cron failed:', err);
    await logAgentRun({ run_type: 'daily_digest', errors: err.message }).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
