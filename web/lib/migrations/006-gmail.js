// Migration 006: Gmail connection. Additive and idempotent.
async function run(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS gmail_accounts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    refresh_token_enc TEXT NOT NULL,
    access_token_enc TEXT,
    expires_at TIMESTAMP,
    connected_at TIMESTAMP NOT NULL DEFAULT now()
  )`);
  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS gmail_thread_id text`);
  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS gmail_message_id text`);
  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS gmail_last_ms bigint`);
  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS sent_via text`);
  const check = await db.query(
    `SELECT (SELECT count(*) FROM gmail_accounts)::int AS accounts,
            (SELECT count(*) FROM information_schema.columns
             WHERE table_name = 'deals' AND column_name = 'gmail_thread_id')::int AS thread_col`
  );
  return check.rows[0];
}

module.exports = { run };
