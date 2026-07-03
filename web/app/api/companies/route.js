import { NextResponse } from 'next/server';
import { listCompanies, createCompany } from '../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await listCompanies());
  } catch (err) {
    console.error('GET /api/companies failed:', err);
    return NextResponse.json({ error: 'Failed to load companies' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  try {
    return NextResponse.json(await createCompany(body), { status: 201 });
  } catch (err) {
    console.error('POST /api/companies failed:', err);
    const status = /unique/i.test(err.message) ? 409 : 500;
    return NextResponse.json({ error: 'Failed to create company' }, { status });
  }
}
