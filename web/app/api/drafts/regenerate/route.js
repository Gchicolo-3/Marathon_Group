import { NextResponse } from 'next/server';
import { regeneratePendingDrafts } from '../../../../lib/regenerate';

// Each failing draft costs one or two model calls, so give the function
// room to work through a full queue.
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await regeneratePendingDrafts();
    if (!process.env.SENDER_PHONE) {
      result.warning =
        'SENDER_PHONE is not set — drafts are signing with a placeholder phone number. Set it in Vercel env vars and redeploy.';
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/drafts/regenerate failed:', err);
    return NextResponse.json({ error: 'Failed to review drafts' }, { status: 500 });
  }
}
