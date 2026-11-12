// Migration 006: Gmail connection for sending and reply reading.
//
//   gmail_accounts: the connected sender (tokens encrypted with TOKEN_ENC_KEY)
//   deals:          gmail_message_id / gmail_thread_id of the sent intro,
//                   gmail_checked_at for the reply reader
//   email_drafts:   gmail_message_id of the sent copy of each draft
//   gmail_messages: every Gmail message we sent or read, so a reply is only
//                   recorded once
//
// Purely additive and idempotent, same as 005.
async function run(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS gmail_accounts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    refresh_token_enc TEXT NOT NULL,
    access_token_enc TEXT,
    expires_at TIMESTAMP,
    connected_at TIMESTAMP NOT NULL DEFAULT now()
  )`);

  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS gmail_message_id text`);
  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS gmail_thread_id text`);
  await db.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS gmail_checked_at timestamp`);
  await db.query(`CREATE INDEX IF NOT EXISTS deals_gmail_thread_id_idx ON deals(gmail_thread_id)`);

  await db.query(`ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS gmail_message_id text`);
  await db.query(`ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS sent_at timestamp`);

  await db.query(`CREATE TABLE IF NOT EXISTS gmail_messages (
    gmail_id TEXT PRIMARY KEY,
    deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
    thread_id TEXT,
    direction TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS gmail_messages_deal_id_idx ON gmail_messages(deal_id)`);

  const check = await db.query(
    `SELECT (SELECT count(*) FROM gmail_accounts)::int AS gmail_accounts,
            (SELECT count(*) FROM information_schema.columns
             WHERE table_name = 'deals' AND column_name = 'gmail_thread_id')::int AS thread_col,
            (SELECT count(*) FROM information_schema.tables
             WHERE table_name = 'gmail_messages')::int AS messages_table`
  );
  return check.rows[0];
}

module.exports = { run };
