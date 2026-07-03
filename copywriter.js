// Copywriter agent — thin wrapper around the shared draft-generation module.
// The Claude prompt/model lives in web/lib/copywriter.js so the batch
// pipeline and the CRM's regenerate endpoint draft emails identically.
require('./web/node_modules/dotenv').config();
require('./web/node_modules/dotenv').config({ path: __dirname + '/web/.env' });

const { draftEmail, runBatch } = require('./web/lib/copywriter');

async function run() {
  console.log('Copywriter: starting...');
  try {
    const result = await runBatch(10);
    console.log(`Copywriter: drafted ${result.drafted} emails`);
    return result;
  } catch (err) {
    console.error('Copywriter error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { draftEmail, run };

if (require.main === module) {
  run().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
