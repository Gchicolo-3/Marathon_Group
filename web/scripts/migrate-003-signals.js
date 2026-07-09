// Migration 003: trigger events (news-agent output, shown on /signals) and
// the agent_runs.notes column that stores the daily morning brief text.
//
//   trigger_events(id, company_id FK nullable, organization, event_type,
//                  description, relevance, source_url, created_at)
//
// Idempotent. Run: node scripts/migrate-003-signals.js
require('dotenv').config();
const db = require('../lib/db');

async function main() {
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
  await db.query(
    `CREATE INDEX IF NOT EXISTS trigger_events_company_id_idx ON trigger_events(company_id)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS trigger_events_created_at_idx ON trigger_events(created_at)`
  );

  await db.query(`ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS notes TEXT`);

  const check = await db.query(
    `SELECT (SELECT count(*) FROM trigger_events)::int AS trigger_events,
            (SELECT count(*) FROM information_schema.columns
             WHERE table_name = 'agent_runs' AND column_name = 'notes')::int AS agent_runs_notes`
  );
  console.log('Post-migration:', check.rows[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
