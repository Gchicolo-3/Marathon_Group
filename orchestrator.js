// Orchestrator — runs the pipeline agents. Imports the copywriter's shared
// draft-generation function (web/lib/copywriter.js) via copywriter.js rather
// than carrying its own copy, so batch runs and manual regenerates from the
// CRM produce emails the same way.
require('./web/node_modules/dotenv').config();
require('./web/node_modules/dotenv').config({ path: __dirname + '/web/.env' });

const copywriter = require('./copywriter');

async function runPipeline() {
  console.log('=== Marathon Pipeline Engine starting ===');
  const summary = { drafted: 0, errors: [] };

  try {
    const copyResult = await copywriter.run();
    summary.drafted = copyResult.drafted || 0;
    if (copyResult.error) summary.errors.push(`Copywriter: ${copyResult.error}`);
  } catch (err) {
    summary.errors.push(`Copywriter: ${err.message}`);
    console.error(err.message);
  }

  console.log('=== Pipeline complete ===');
  console.log(`Emails drafted: ${summary.drafted}`);
  if (summary.errors.length > 0) {
    console.log('Errors:', summary.errors.join(', '));
  }
  return summary;
}

module.exports = { runPipeline };

if (require.main === module) {
  runPipeline().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
