import { NextResponse } from 'next/server';
import { getDeal, updateDeal, deleteDeal } from '../../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const deal = await getDeal(id);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(deal);
  } catch (err) {
    console.error(`GET /api/deals/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to load deal' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const deal = await updateDeal(id, body);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json(deal);
  } catch (err) {
    console.error(`PUT /api/deals/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const deleted = await deleteDeal(id);
    if (!deleted) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/deals/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 });
  }
}
