import { NextResponse } from 'next/server';
import { runPipeline } from '../../../../lib/pipeline';

// Manual pipeline pass from the /runs page — same steps as the cron:
// qualify new deals -> week-1 drafts -> due campaign follow-ups.
export const maxDuration = 300;

export async function POST() {
  try {
    const summary = await runPipeline();
    return NextResponse.json(summary);
  } catch (err) {
    console.error('POST /api/pipeline/run failed:', err);
    if (/ANTHROPIC_API_KEY/.test(err.message)) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured on the server' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Pipeline run failed' }, { status: 500 });
  }
}
