// Prospector agent — thin wrapper around the shared prospecting module.
// The two-step flow (Perplexity live search -> Claude structured parse)
// lives in web/lib/prospector.js so the batch pipeline and the CRM's cron
// pipeline find prospects identically.
require('./web/node_modules/dotenv').config();
require('./web/node_modules/dotenv').config({ path: __dirname + '/web/.env' });

const { runProspectorBatch } = require('./web/lib/prospector');

async function run() {
  console.log('Prospector: starting...');
  try {
    const result = await runProspectorBatch(10);
    console.log(`Prospector: found ${result.found} prospects, saved ${result.saved} new`);
    return result;
  } catch (err) {
    console.error('Prospector error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { run };

if (require.main === module) {
  run().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
