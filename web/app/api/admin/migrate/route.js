import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export const maxDuration = 60;

// Runs migrations 005 and 006 (additive, idempotent). Behind the dashboard login.
export async function POST() {
  try {
    const m5 = require('../../../../lib/migrations/005-enrichment');
    const m6 = require('../../../../lib/migrations/006-gmail');
    const result = { ...(await m5.run(db)), ...(await m6.run(db)) };
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('admin migrate failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
