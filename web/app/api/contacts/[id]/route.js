import { NextResponse } from 'next/server';
import { getContact, updateContact, deleteContact } from '../../../../lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const contact = await getContact(id);
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    return NextResponse.json(contact);
  } catch (err) {
    console.error(`GET /api/contacts/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to load contact' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const contact = await updateContact(id, body);
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    return NextResponse.json(contact);
  } catch (err) {
    console.error(`PUT /api/contacts/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const deleted = await deleteContact(id);
    if (!deleted) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/contacts/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
