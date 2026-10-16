// Migration 005: contact verification, reply tracking, scoring breakdown.
//
//   contacts: email_status, email_verified_at, enrichment_attempts,
//             enrichment_last_at, enrichment_source, external_id
//   deals:    first_reply_at (the billing trigger), reply_classification,
//             score_breakdown, scored_at
//   companies: segment
//   enrichment_log: one row per provider lookup (drives the credit meter)
//   activity_kind: adds 'reply'
//
// Purely additive and idempotent, so it is safe to run BEFORE the new code
// is merged: the currently deployed app ignores the new columns.
// Run: node scripts/migrate-005-enrichment.js
require('dotenv').config();
const db = require('../lib/db');

async function main() {
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'unverified'`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_verified_at timestamp`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS enrichment_attempts integer NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS enrichment_last_at timestamp`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS enrichment_source text`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS external_id text`);

  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS first_reply_at timestamp`);
  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS reply_classification text`);
  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS score_breakdown jsonb`);
  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS scored_at timestamp`);

  await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS segment text`);

  await db.query(`CREATE TABLE IF NOT EXISTS enrichment_log (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    outcome TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS enrichment_log_created_at_idx ON enrichment_log(created_at)`);

  // Enum additions cannot be undone and must not run inside a transaction
  // block; each statement here is its own implicit transaction.
  await db.query(`ALTER TYPE activity_kind ADD VALUE IF NOT EXISTS 'reply'`);

  // Deals already scored before this migration count as scored.
  await db.query(`UPDATE deals SET scored_at = COALESCE(scored_at, updated_at) WHERE score IS NOT NULL AND scored_at IS NULL`);

  const check = await db.query(
    `SELECT (SELECT count(*) FROM contacts WHERE email_status = 'unverified')::int AS unverified,
            (SELECT count(*) FROM contacts)::int AS contacts,
            (SELECT count(*) FROM information_schema.columns
             WHERE table_name = 'deals' AND column_name = 'first_reply_at')::int AS first_reply_col,
            (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'activity_kind' AND e.enumlabel = 'reply')::int AS reply_kind`
  );
  console.log('Post-migration:', check.rows[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
