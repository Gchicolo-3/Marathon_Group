import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { scoreDeal } from '../../../../lib/qualifier';

export const maxDuration = 300;

// Scores deals that have no v2 breakdown yet, 8 per call. NEVER moves a
// deal between stages. The page calls this repeatedly until remaining is 0.
export async function POST() {
  try {
    const ids = (
      await db.query(
        `SELECT id FROM deals
         WHERE score_breakdown IS NULL AND stage NOT IN ('won','lost','replied','meeting_set')
         ORDER BY id LIMIT 8`
      )
    ).rows.map((r) => r.id);

    let scored = 0, passed = 0;
    const errors = [];
    for (const id of ids) {
      try {
        const r = await scoreDeal(id, { moveStage: false });
        if (r) { scored++; if (r.passed) passed++; }
      } catch (err) {
        errors.push(`deal ${id}: ${err.message}`);
        // mark as attempted so one bad deal cannot block the loop
        await db.query(`UPDATE deals SET score_breakdown = '{"error":true}'::jsonb WHERE id = $1 AND score_breakdown IS NULL`, [id]);
      }
    }
    const remaining = (
      await db.query(
        `SELECT count(*)::int AS n FROM deals
         WHERE score_breakdown IS NULL AND stage NOT IN ('won','lost','replied','meeting_set')`
      )
    ).rows[0].n;
    return NextResponse.json({ scored, passed, remaining, errors });
  } catch (err) {
    console.error('admin rescore failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
