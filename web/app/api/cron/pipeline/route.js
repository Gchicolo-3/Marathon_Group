import { NextResponse } from 'next/server';
import { runPipeline } from '../../../../lib/pipeline';

// Scheduled pipeline pass, invoked by Vercel Cron (see web/vercel.json):
// qualify new deals -> week-1 drafts for qualified deals -> campaign
// follow-ups for contacted deals that are due. Authenticated via CRON_SECRET
// (Vercel sends it as a Bearer token) — the middleware lets /api/cron/*
// through and this check gates it instead.
export const maxDuration = 300;

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runPipeline();
    console.log('Cron pipeline run:', JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (err) {
    console.error('Cron pipeline run failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
