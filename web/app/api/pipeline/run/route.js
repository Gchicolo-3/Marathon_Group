import { NextResponse } from 'next/server';
import { runBatch } from '../../../../lib/copywriter';
import { logAgentRun } from '../../../../lib/queries';

// Trigger a copywriter batch from the CRM: drafts emails for deals in the
// 'qualified' stage that have no draft yet, using the same shared
// draft-generation module as the root pipeline. Logs to agent_runs either way.
export const maxDuration = 300;

const BATCH_LIMIT = 5; // keep well inside the serverless time budget

export async function POST() {
  try {
    const result = await runBatch(BATCH_LIMIT);
    const run = await logAgentRun({
      run_type: 'draft_generation',
      drafts_created: result.drafted,
    });
    return NextResponse.json({ ...result, run });
  } catch (err) {
    console.error('POST /api/pipeline/run failed:', err);
    await logAgentRun({
      run_type: 'draft_generation',
      drafts_created: 0,
      errors: err.message,
    }).catch(() => {});
    if (/ANTHROPIC_API_KEY/.test(err.message)) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured on the server' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Pipeline run failed' }, { status: 500 });
  }
}
