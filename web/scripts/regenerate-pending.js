// One-shot: regenerate every PENDING draft with the current prompt — correct
// Michael Sullivan signature, first-name greeting, and voice QA. Approved and
// sent drafts are left untouched; each regeneration inserts a new draft
// version (history preserved) that replaces the stale one in the queue.
// Run: node scripts/regenerate-pending.js  (needs DATABASE_URL + ANTHROPIC_API_KEY)
require('dotenv').config();
const db = require('../lib/db');
const { draftEmail } = require('../lib/copywriter');
const { getDraftContext, insertDraft, logActivity } = require('../lib/queries');

async function main() {
  const r = await db.query(
    `SELECT d.id, d.campaign_week
     FROM deals d
     WHERE (SELECT e.status FROM email_drafts e
            WHERE e.deal_id = d.id ORDER BY e.id DESC LIMIT 1) = 'pending'
     ORDER BY d.id`
  );
  console.log(`${r.rows.length} deal(s) with a pending draft to regenerate.`);

  let done = 0;
  for (const row of r.rows) {
    const ctx = await getDraftContext(row.id);
    if (!ctx) {
      console.warn(`deal ${row.id}: no draft context found — skipped`);
      continue;
    }
    const draft = await draftEmail(ctx, row.campaign_week || 1);
    await insertDraft(row.id, draft);
    await logActivity(row.id, 'ai_regenerate', `Draft regenerated with updated voice and signature: "${draft.subject}"`);
    done++;
    console.log(`deal ${row.id} (${ctx.first_name} ${ctx.last_name || ''} · ${ctx.company}): "${draft.subject}"`);
  }
  console.log(`Regenerated ${done}/${r.rows.length} pending drafts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
