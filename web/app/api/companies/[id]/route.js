import { NextResponse } from 'next/server';
import { getCompany, updateCompany, deleteCompany } from '../../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const company = await getCompany(id);
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    return NextResponse.json(company);
  } catch (err) {
    console.error(`GET /api/companies/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to load company' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const company = await updateCompany(id, body);
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    return NextResponse.json(company);
  } catch (err) {
    console.error(`PUT /api/companies/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const deleted = await deleteCompany(id);
    if (!deleted) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/companies/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
  }
}
