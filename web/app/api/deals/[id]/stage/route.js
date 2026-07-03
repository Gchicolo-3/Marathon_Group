import { NextResponse } from 'next/server';
import { setDealStage, STAGES } from '../../../../../lib/queries';

// Move a deal to a new stage; logs a stage_change activity.
export async function POST(request, { params }) {
  const { id } = await params;
  const { stage } = await request.json().catch(() => ({}));

  if (!STAGES.includes(stage)) {
    return NextResponse.json(
      { error: `stage must be one of: ${STAGES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const deal = await setDealStage(id, stage);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(deal);
  } catch (err) {
    console.error(`POST /api/deals/${id}/stage failed:`, err);
    return NextResponse.json({ error: 'Failed to change stage' }, { status: 500 });
  }
}
