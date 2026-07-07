import { NextResponse } from 'next/server';
import { qualifyDeal } from '../../../../../lib/qualifier';

// Score this deal with AI against the ICP (same prompt/model as the
// pipeline Qualifier agent). Sets score, moves stage to qualified/lost,
// logs the reasoning as an activity.
export const maxDuration = 60;

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const result = await qualifyDeal(id);
    if (!result) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error(`POST /api/deals/${id}/qualify failed:`, err);
    if (/ANTHROPIC_API_KEY/.test(err.message)) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured on the server' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to qualify deal' }, { status: 500 });
  }
}
