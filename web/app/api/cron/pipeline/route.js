import { NextResponse } from 'next/server';
import { runBatch } from '../../../../lib/copywriter';
import { logAgentRun } from '../../../../lib/queries';

// Scheduled pipeline run, invoked by Vercel Cron (see web/vercel.json).
// Authenticated via CRON_SECRET (Vercel sends it as a Bearer token), not the
// dashboard session cookie — the middleware lets /api/cron/* through and this
// check gates it instead.
export const maxDuration = 300;

const BATCH_LIMIT = 10;

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runBatch(BATCH_LIMIT);
    const run = await logAgentRun({
      run_type: 'draft_generation',
      drafts_created: result.drafted,
    });
    console.log(`Cron pipeline run: drafted ${result.drafted}`);
    return NextResponse.json({ ...result, run });
  } catch (err) {
    console.error('Cron pipeline run failed:', err);
    await logAgentRun({
      run_type: 'draft_generation',
      drafts_created: 0,
      errors: err.message,
    }).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
