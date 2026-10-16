import { NextResponse } from 'next/server';
import { checkReplies } from '../../../../lib/gmail';

export const maxDuration = 60;

// Manual "Check replies now". Behind the dashboard login.
export async function POST() {
  try {
    return NextResponse.json(await checkReplies());
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
