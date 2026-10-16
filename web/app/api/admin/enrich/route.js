import { NextResponse } from 'next/server';
import { runEnrichmentBatch, getUsage } from '../../../../lib/enrich';
import { isConfigured } from '../../../../lib/enrichment';

export const maxDuration = 300;

// Verifies the next N unverified contacts (highest scored first).
export async function POST(request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Enrichment is not configured. Add EXPLORIUM_API_KEY and ENRICHMENT_PROVIDER=vibe in Vercel, then redeploy.' },
      { status: 503 }
    );
  }
  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 25);
  try {
    const result = await runEnrichmentBatch(limit);
    return NextResponse.json({ ...result, usage: await getUsage() });
  } catch (err) {
    console.error('admin enrich failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
