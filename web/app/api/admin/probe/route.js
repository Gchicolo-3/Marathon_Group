import { NextResponse } from 'next/server';
import { isConfigured } from '../../../../lib/enrichment';

export const maxDuration = 60;

// Shows the RAW provider response for one person so the field mapping can be
// checked against reality. Costs one lookup. Writes nothing to the database.
export async function POST(request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'EXPLORIUM_API_KEY is not set in Vercel' }, { status: 503 });
  }
  const { name, company } = await request.json().catch(() => ({}));
  if (!name || !company) {
    return NextResponse.json({ error: 'Enter a full name and a company' }, { status: 400 });
  }
  try {
    const vibe = require('../../../../lib/enrichment/vibe');
    const id = await vibe.matchProspect({ name, company });
    if (!id) return NextResponse.json({ prospect_id: null, note: 'No match. Nothing was charged.' });
    const raw = await vibe.post('/prospects/contacts_information/enrich', { prospect_id: id });
    return NextResponse.json({ prospect_id: id, parsed: vibe.parseContactInfo(raw), raw });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
