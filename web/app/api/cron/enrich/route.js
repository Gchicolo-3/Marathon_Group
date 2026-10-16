import { NextResponse } from 'next/server';
import { runEnrichmentBatch } from '../../../../lib/enrich';
import { isConfigured } from '../../../../lib/enrichment';

export const maxDuration = 300;

// Optional standalone enrichment pass (also runs inside the main pipeline).
export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isConfigured()) return NextResponse.json({ skipped: 'enrichment not configured' });
  try {
    return NextResponse.json(await runEnrichmentBatch(25));
  } catch (err) {
    console.error('Cron enrich failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
