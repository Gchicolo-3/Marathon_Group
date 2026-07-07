// Migration 002: 26-week campaign tracking.
//   deals.campaign_week        — the week of the deal's current/latest email (starts at 1)
//   email_drafts.campaign_week — which campaign week a draft belongs to
// Idempotent. Run: node scripts/migrate-002-campaign.js
require('dotenv').config();
const db = require('../lib/db');

async function main() {
  await db.query(
    `ALTER TABLE deals ADD COLUMN IF NOT EXISTS campaign_week integer NOT NULL DEFAULT 1`
  );
  await db.query(
    `ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS campaign_week integer`
  );
  await db.query(`UPDATE email_drafts SET campaign_week = 1 WHERE campaign_week IS NULL`);

  const check = await db.query(
    `SELECT (SELECT count(*) FROM deals WHERE campaign_week IS NULL)::int AS deals_null,
            (SELECT count(*) FROM email_drafts WHERE campaign_week IS NULL)::int AS drafts_null,
            (SELECT count(*) FROM deals)::int AS deals,
            (SELECT count(*) FROM email_drafts)::int AS drafts`
  );
  console.log('Post-migration:', check.rows[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
