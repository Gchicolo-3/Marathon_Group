import { NextResponse } from 'next/server';
import { verifyContact, markManuallyVerified } from '../../../../../lib/enrich';

export const maxDuration = 60;

// POST {}                  -> run a provider lookup for this contact
// POST { manual: true }    -> confirm the email by hand (requires an email on file)
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    if (body.manual) {
      const contact = await markManuallyVerified(id);
      if (!contact) {
        return NextResponse.json({ error: 'Contact has no email to confirm' }, { status: 400 });
      }
      return NextResponse.json({ outcome: 'manual', contact });
    }
    const result = await verifyContact(id, { force: true });
    if (!result) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    if (err.code === 'NOT_CONFIGURED') {
      return NextResponse.json({ error: err.message, code: 'NOT_CONFIGURED' }, { status: 503 });
    }
    console.error(`POST /api/contacts/${id}/verify failed:`, err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
