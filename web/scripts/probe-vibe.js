// Prints the RAW provider response for one contact so the field mapping can
// be checked against reality before any batch spend. Costs one lookup.
//   node scripts/probe-vibe.js "Jane Doe" "Hackensack Meridian Health"
require('dotenv').config();
const vibe = require('../lib/enrichment/vibe');

async function main() {
  const [name, company] = process.argv.slice(2);
  if (!name || !company) {
    console.error('Usage: node scripts/probe-vibe.js "Full Name" "Company Name"');
    process.exit(1);
  }
  const id = await vibe.matchProspect({ name, company });
  console.log('prospect_id:', id);
  if (!id) return console.log('No match. Nothing was spent.');
  const raw = await vibe.post('/prospects/contacts_information/enrich', { prospect_id: id });
  console.log('RAW RESPONSE:');
  console.log(JSON.stringify(raw, null, 2));
  console.log('PARSED:', vibe.parseContactInfo(raw));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
