import { NextResponse } from 'next/server';
import { listContacts, createContact } from '../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await listContacts());
  } catch (err) {
    console.error('GET /api/contacts failed:', err);
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!body.company_id || !body.name) {
    return NextResponse.json({ error: 'company_id and name are required' }, { status: 400 });
  }
  try {
    return NextResponse.json(await createContact(body), { status: 201 });
  } catch (err) {
    console.error('POST /api/contacts failed:', err);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
