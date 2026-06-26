require('dotenv').config();
const db = require('./db/client');
const prospector = require('./agents/prospector');
const qualifier = require('./agents/qualifier');
const copywriter = require('./agents/copywriter');
const cron = require('node-cron');

async function logRun(type, results) {
  await db.query(
    `INSERT INTO agent_runs (run_type, prospects_found, drafts_created, errors)
     VALUES ($1,$2,$3,$4)`,
    [
      type,
      results.found || 0,
      results.drafted || 0,
      results.error || null
    ]
  );
}

async function runWithRetry(agent, name, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    console.log(`Orchestrator: running ${name} (attempt ${i + 1})`);
    const result = await agent.run();
    if (result.success) return result;
    console.log(`Orchestrator: ${name} failed, retrying...`);
  }
  throw new Error(`${name} failed after ${maxRetries} attempts`);
}

async function runPipeline() {
  console.log('=== Marathon Pipeline Engine starting ===');
  const summary = { found: 0, drafted: 0, errors: [] };

  try {
    const prospectResult = await runWithRetry(prospector, 'Prospector');
    summary.found = prospectResult.saved || 0;
    await logRun('lead_pull', prospectResult);
  } catch (err) {
    summary.errors.push(`Prospector: ${err.message}`);
    console.error(err.message);
  }

  try {
    const qualifyResult = await runWithRetry(qualifier, 'Qualifier');
    await logRun('qualification', qualifyResult);
  } catch (err) {
    summary.errors.push(`Qualifier: ${err.message}`);
    console.error(err.message);
  }

  try {
    const copyResult = await runWithRetry(copywriter, 'Copywriter');
    summary.drafted = copyResult.drafted || 0;
    await logRun('draft_generation', copyResult);
  } catch (err) {
    summary.errors.push(`Copywriter: ${err.message}`);
    console.error(err.message);
  }

  console.log('=== Pipeline complete ===');
  console.log(`Prospects found: ${summary.found}`);
  console.log(`Emails drafted: ${summary.drafted}`);
  if (summary.errors.length > 0) {
    console.log('Errors:', summary.errors.join(', '));
  }

  return summary;
}

// Run once immediately if called directly
if (require.main === module) {
  runPipeline().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// Schedule daily at 7am Eastern on weekdays
cron.schedule('0 7 * * 1-5', () => {
  console.log('Scheduled pipeline run starting...');
  runPipeline();
}, { timezone: 'America/New_York' });

module.exports = { runPipeline };
