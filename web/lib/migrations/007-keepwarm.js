// Migration 007: keep warm engine (Phase A).
//
//   contacts:     keep_warm flag, per person cadence, last / next touch,
//                 a relationship note, and the Excel tab it came from
//   touches:      one row per two line note: pending -> sent | skipped,
//                 with the Gmail ids once sent and replied_at when they answer
//   app_settings: key / jsonb value (cadence default, voice samples, pause)
//
// Purely additive and idempotent, same as 005 and 006.
async function run(db) {
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS keep_warm boolean NOT NULL DEFAULT false`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cadence_days integer`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_touch_at timestamp`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_touch_at timestamp`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS relationship_note text`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS list_tab text`);
  await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS imported_at timestamp`);
  await db.query(`CREATE INDEX IF NOT EXISTS contacts_keep_warm_next_idx ON contacts(keep_warm, next_touch_at)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS contacts_email_lower_uidx ON contacts (lower(email)) WHERE email IS NOT NULL AND email <> '' AND keep_warm`);

  await db.query(`CREATE TABLE IF NOT EXISTS touches (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    subject TEXT,
    body TEXT,
    instructions TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    sent_at TIMESTAMP,
    skipped_at TIMESTAMP,
    gmail_message_id TEXT,
    gmail_thread_id TEXT,
    gmail_checked_at TIMESTAMP,
    replied_at TIMESTAMP,
    reply_snippet TEXT
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS touches_status_idx ON touches(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS touches_contact_idx ON touches(contact_id)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS touches_one_pending_uidx ON touches(contact_id) WHERE status = 'pending'`);

  await db.query(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`);

  const check = await db.query(
    `SELECT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'touches')::int AS touches_table,
            (SELECT count(*) FROM information_schema.tables WHERE table_name = 'app_settings')::int AS settings_table,
            (SELECT count(*) FROM contacts WHERE keep_warm)::int AS keep_warm_contacts`
  );
  return check.rows[0];
}

module.exports = { run };
