import { NextResponse } from 'next/server';
import { getDigest, sendDigestEmail } from '../../../../lib/digest';
import { logAgentRun } from '../../../../lib/queries';

// Daily digest cron (8 AM ET weekdays, see web/vercel.json). Computes the
// digest and emails it to Michael when Resend is configured.
export const maxDuration = 60;

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const digest = await getDigest();
    const delivery = await sendDigestEmail(digest);
    await logAgentRun({ run_type: 'daily_digest' }).catch(() => {});
    console.log('Digest:', JSON.stringify({ ...digest, delivery }));
    return NextResponse.json({ ...digest, delivery });
  } catch (err) {
    console.error('Digest cron failed:', err);
    await logAgentRun({ run_type: 'daily_digest', errors: err.message }).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
