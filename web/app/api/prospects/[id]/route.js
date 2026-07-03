import { NextResponse } from 'next/server';
import { getProspect } from '../../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const prospect = await getProspect(id);
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }
    return NextResponse.json(prospect);
  } catch (err) {
    console.error(`GET /api/prospects/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to load prospect' }, { status: 500 });
  }
}
