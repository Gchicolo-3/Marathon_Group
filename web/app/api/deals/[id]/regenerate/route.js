import { NextResponse } from 'next/server';
import { getDraftContext, insertDraft, logActivity } from '../../../../../lib/queries';
import { draftEmail } from '../../../../../lib/copywriter';

// Redraft the email with the same Claude prompt/model the Copywriter agent
// uses (web/lib/copywriter.js). Saves the result as a NEW draft version and
// logs an ai_regenerate activity.
export const maxDuration = 60;

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const context = await getDraftContext(id);
    if (!context) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    const { subject, body } = await draftEmail(context);
    const draft = await insertDraft(id, { subject, body });
    await logActivity(id, 'ai_regenerate', `Email redrafted by AI: "${subject}"`);

    return NextResponse.json(draft, { status: 201 });
  } catch (err) {
    console.error(`POST /api/deals/${id}/regenerate failed:`, err);
    if (/ANTHROPIC_API_KEY/.test(err.message)) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured on the server' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to regenerate draft' }, { status: 500 });
  }
}
