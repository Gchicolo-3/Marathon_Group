// Re-score every deal under scoring v2 and print the distribution.
// By default this ONLY updates scores and breakdowns. It does not move any
// deal between stages, so you can review the numbers first.
//   node scripts/rescore-deals.js                 scores only, no stage changes
//   node scripts/rescore-deals.js --requalify     also apply the stage decision
//   node scripts/rescore-deals.js --refresh-model re-run the model part (default reuses cache)
//   node scripts/rescore-deals.js --limit=20      first 20 deals only
require('dotenv').config();
const db = require('../lib/db');
const { scoreDeal } = require('../lib/qualifier');

async function main() {
  const requalify = process.argv.includes('--requalify');
  const refreshModel = process.argv.includes('--refresh-model');
  const limit = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || null;

  const ids = (
    await db.query(`SELECT id FROM deals WHERE stage NOT IN ('won','lost','replied','meeting_set') ORDER BY id ${limit ? `LIMIT ${limit}` : ''}`)
  ).rows.map((r) => r.id);
  console.log(`Re-scoring ${ids.length} deals (${requalify ? 'WITH' : 'without'} stage changes)`);

  const buckets = {};
  let failed = 0, passed = 0;
  for (const id of ids) {
    try {
      const r = await scoreDeal(id, { refreshModel, moveStage: requalify });
      if (!r) continue;
      buckets[r.score] = (buckets[r.score] || 0) + 1;
      if (r.passed) passed++;
    } catch (err) {
      failed++;
      console.error(`deal ${id}: ${err.message}`);
    }
  }
  console.log('Score distribution (score: deals):');
  console.table(Object.entries(buckets).sort((a, b) => b[0] - a[0]).map(([score, n]) => ({ score, deals: n })));
  console.log(`Passed all four gates: ${passed}. Failed to score: ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
