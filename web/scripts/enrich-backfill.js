// One-time backfill: verify existing contacts through the enrichment
// provider, highest scored deals first.
//   node scripts/enrich-backfill.js              verify up to 25 contacts
//   node scripts/enrich-backfill.js --limit=100  verify up to 100
//   node scripts/enrich-backfill.js --dry-run    show who would be looked up, spend nothing
require('dotenv').config();
const db = require('../lib/db');
const { runEnrichmentBatch, MAX_ATTEMPTS } = require('../lib/enrich');
const { isConfigured } = require('../lib/enrichment');

async function main() {
  const limit = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || 25;
  const dry = process.argv.includes('--dry-run');

  const eligible = await db.query(
    `SELECT count(*)::int AS n FROM contacts
     WHERE email_status IN ('unverified','no_match','catch_all') AND enrichment_attempts < $1`,
    [MAX_ATTEMPTS]
  );
  console.log(`Contacts eligible for lookup: ${eligible.rows[0].n}`);
  if (dry) return;

  if (!isConfigured()) {
    console.error('Enrichment is not configured. Set EXPLORIUM_API_KEY and ENRICHMENT_PROVIDER=vibe.');
    process.exit(1);
  }
  const result = await runEnrichmentBatch(limit);
  console.log('Backfill result:', result);
  const after = await db.query(
    `SELECT email_status, count(*)::int AS n FROM contacts GROUP BY email_status ORDER BY n DESC`
  );
  console.table(after.rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
