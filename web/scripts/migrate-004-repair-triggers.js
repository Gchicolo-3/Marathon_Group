// Migration 004: repair an incomplete migration 003.
//
// Production symptom (Vercel logs):
//   getLatestBrief:     column "notes" does not exist        (agent_runs)
//   listTriggerEvents:  column t.company_id does not exist   (trigger_events)
//
// Root cause: a trigger_events table already existed in Neon with an older
// shape (no company_id). Migration 003's `CREATE TABLE IF NOT EXISTS` was a
// no-op against it, then `CREATE INDEX ... (company_id)` crashed, so the
// script exited before ever reaching `ALTER TABLE agent_runs ADD COLUMN
// notes`. This script converges the live schema onto what migration 003
// intended, whatever the starting state:
//   - creates trigger_events if missing entirely
//   - adds any missing trigger_events columns (nullable/defaulted, so it
//     works even if the table already has rows)
//   - creates the two indexes
//   - adds agent_runs.notes
//
// Idempotent. Run: node scripts/migrate-004-repair-triggers.js
require('dotenv').config();
const db = require('../lib/db');

async function triggerEventColumns() {
  const r = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'trigger_events'
     ORDER BY ordinal_position`
  );
  return r.rows.map((row) => row.column_name);
}

async function main() {
  const before = await triggerEventColumns();
  console.log('trigger_events columns before:', before.length ? before.join(', ') : '(table missing)');

  await db.query(`CREATE TABLE IF NOT EXISTS trigger_events (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    organization TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'other',
    description TEXT NOT NULL,
    relevance TEXT,
    source_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`);

  // Columns migration 003 expected. Added nullable (or with a default) so
  // this succeeds even when the stale table already contains rows.
  const addColumns = [
    `company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`,
    `organization TEXT`,
    `event_type TEXT DEFAULT 'other'`,
    `description TEXT`,
    `relevance TEXT`,
    `source_url TEXT`,
    `created_at TIMESTAMP DEFAULT now()`,
  ];
  for (const col of addColumns) {
    await db.query(`ALTER TABLE trigger_events ADD COLUMN IF NOT EXISTS ${col}`);
  }

  await db.query(
    `CREATE INDEX IF NOT EXISTS trigger_events_company_id_idx ON trigger_events(company_id)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS trigger_events_created_at_idx ON trigger_events(created_at)`
  );

  // The part of migration 003 that never ran because of the index crash.
  await db.query(`ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS notes TEXT`);

  const after = await triggerEventColumns();
  const check = await db.query(
    `SELECT (SELECT count(*) FROM trigger_events)::int AS trigger_event_rows,
            (SELECT count(*) FROM information_schema.columns
             WHERE table_name = 'agent_runs' AND column_name = 'notes')::int AS agent_runs_notes`
  );
  console.log('trigger_events columns after: ', after.join(', '));
  console.log('Post-migration:', check.rows[0]);
  if (check.rows[0].agent_runs_notes !== 1 || !after.includes('company_id')) {
    console.error('Repair incomplete — check output above.');
    process.exit(1);
  }
  console.log('Repair complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
