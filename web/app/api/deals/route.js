import { NextResponse } from 'next/server';
import { listDeals, createDeal, STAGES } from '../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await listDeals());
  } catch (err) {
    console.error('GET /api/deals failed:', err);
    return NextResponse.json({ error: 'Failed to load deals' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!body.contact_id || !body.company_id) {
    return NextResponse.json({ error: 'contact_id and company_id are required' }, { status: 400 });
  }
  if (body.stage && !STAGES.includes(body.stage)) {
    return NextResponse.json({ error: `stage must be one of: ${STAGES.join(', ')}` }, { status: 400 });
  }
  try {
    return NextResponse.json(await createDeal(body), { status: 201 });
  } catch (err) {
    console.error('POST /api/deals failed:', err);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}
