import { NextResponse } from 'next/server';
import { checkReplies } from '../../../../lib/gmail';

export const maxDuration = 60;

// Reply reader. Not in vercel.json (the plan's cron limit is once a day);
// the daily pipeline run calls it, the Check replies button calls it, and
// this endpoint is here for an external pinger or a paid cron plan.
export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await checkReplies());
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
