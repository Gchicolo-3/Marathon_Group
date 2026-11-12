import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export const maxDuration = 60;

// Runs migrations 005 and 006 (both additive, idempotent). Behind the
// dashboard login.
export async function POST() {
  try {
    const result = {};
    result['005'] = await require('../../../../lib/migrations/005-enrichment').run(db);
    result['006'] = await require('../../../../lib/migrations/006-gmail').run(db);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('admin migrate failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
