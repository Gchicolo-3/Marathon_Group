// Prints the actual columns of the prospects / email_drafts tables in Neon,
// plus row counts and a data sample — run before trusting the query layer:
//   npm run introspect   (reads DATABASE_URL from .env)
require('dotenv').config();
const db = require('../lib/db');

async function main() {
  const cols = await db.query(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('prospects', 'email_drafts')
     ORDER BY table_name, ordinal_position`
  );
  console.log('=== Columns ===');
  for (const r of cols.rows) {
    console.log(`${r.table_name}.${r.column_name}  ${r.data_type}  ${r.is_nullable === 'YES' ? 'nullable' : 'not null'}`);
  }

  const counts = await db.query(
    `SELECT (SELECT count(*) FROM prospects) AS prospects,
            (SELECT count(*) FROM email_drafts) AS email_drafts`
  );
  console.log('\n=== Row counts ===');
  console.log(counts.rows[0]);

  const sample = await db.query(
    `SELECT p.id, p.first_name, p.last_name, p.company, p.title, p.qualification_score,
            d.subject, d.status
     FROM prospects p
     LEFT JOIN email_drafts d ON d.prospect_id = p.id
     ORDER BY p.qualification_score DESC NULLS LAST
     LIMIT 12`
  );
  console.log('\n=== Sample (dashboard query) ===');
  console.table(sample.rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
