// Migration 006: Gmail connection (gmail_accounts, gmail_messages, the
// thread / message id columns on deals and email_drafts).
//
// Purely additive and idempotent, safe to run BEFORE the new code is
// merged. Also runs from the "Run migration" button on /runs.
// Run: node scripts/migrate-006-gmail.js
require('dotenv').config();
const db = require('../lib/db');

async function main() {
  const check = await require('../lib/migrations/006-gmail').run(db);
  console.log('Post-migration:', check);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
