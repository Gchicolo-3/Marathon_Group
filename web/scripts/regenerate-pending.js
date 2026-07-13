// CLI twin of the "Review & refresh drafts" button on /runs — reviews every
// pending draft against the voice guide and rewrites only the failures.
// Run: node scripts/regenerate-pending.js  (needs DATABASE_URL + ANTHROPIC_API_KEY)
require('dotenv').config();
const { regeneratePendingDrafts } = require('../lib/regenerate');

regeneratePendingDrafts()
  .then((result) => {
    console.log(`Checked ${result.checked} pending draft(s): ${result.regenerated} rewritten, ${result.passed} already on-voice.`);
    for (const d of result.details) {
      console.log(`- deal ${d.deal_id} (${d.company}): ${d.issues.join('; ')}`);
    }
    if (!process.env.SENDER_PHONE) {
      console.warn('⚠ SENDER_PHONE is not set — signatures use a placeholder phone number.');
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
