// Review-and-refresh for pending drafts: every deal whose latest draft is
// still pending gets its draft run through the voice review; only FAILING
// drafts (wrong signature, no first-name greeting, banned phrases, stale
// phone number) are regenerated. Idempotent — drafts that pass are skipped,
// so the button in the UI is safe to click any time.
const db = require('./db');
const { draftEmail, reviewDraft } = require('./copywriter');
const { getDraftContext, insertDraft, logActivity } = require('./queries');

async function regeneratePendingDrafts(limit = 25) {
  const r = await db.query(
    `SELECT d.id, d.campaign_week, e.subject, e.body
     FROM deals d
     JOIN LATERAL (
       SELECT subject, body, status FROM email_drafts
       WHERE deal_id = d.id ORDER BY id DESC LIMIT 1
     ) e ON e.status = 'pending'
     ORDER BY d.id
     LIMIT $1`,
    [limit]
  );

  const result = { checked: r.rows.length, passed: 0, regenerated: 0, details: [] };

  for (const row of r.rows) {
    const ctx = await getDraftContext(row.id);
    if (!ctx) continue;

    const issues = reviewDraft({ subject: row.subject, body: row.body }, ctx);
    if (issues.length === 0) {
      result.passed++;
      continue;
    }

    const draft = await draftEmail(ctx, row.campaign_week || 1);
    await insertDraft(row.id, draft);
    await logActivity(
      row.id,
      'ai_regenerate',
      `Draft rewritten by quality review (${issues[0]}): "${draft.subject}"`
    );
    result.regenerated++;
    result.details.push({ deal_id: row.id, company: ctx.company, issues });
  }

  return result;
}

module.exports = { regeneratePendingDrafts };
