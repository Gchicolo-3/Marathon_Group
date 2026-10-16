import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export const maxDuration = 60;

// Runs migration 005 (additive, idempotent). Behind the dashboard login.
export async function POST() {
  try {
    const { run } = require('../../../../lib/migrations/005-enrichment');
    const result = await run(db);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('admin migrate failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
