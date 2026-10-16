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
  const check = await require('../lib/migrations/005-enrichment').run(db);
  console.log('Post-migration:', check);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
