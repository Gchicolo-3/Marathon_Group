// The full CRM pipeline pass, shared by the cron job and the manual Run
// button: qualify new deals, draft week-1 emails for qualified deals, then
// draft campaign follow-ups for contacted deals that are due. Each step logs
// its own agent_runs row so /runs shows exactly what happened.
const { runQualifierBatch } = require('./qualifier');
const { runBatch, runFollowUpBatch } = require('./copywriter');
const { logAgentRun } = require('./queries');

async function runPipeline({ qualifyLimit = 10, draftLimit = 5, followUpLimit = 5 } = {}) {
  const summary = { scored: 0, qualified: 0, drafted: 0, follow_ups: 0, errors: [] };

  try {
    const q = await runQualifierBatch(qualifyLimit);
    summary.scored = q.scored;
    summary.qualified = q.qualified;
    if (q.scored > 0) {
      await logAgentRun({ run_type: 'qualification', prospects_found: q.scored });
    }
  } catch (err) {
    summary.errors.push(`qualifier: ${err.message}`);
    await logAgentRun({ run_type: 'qualification', errors: err.message }).catch(() => {});
  }

  try {
    const d = await runBatch(draftLimit);
    summary.drafted = d.drafted;
  } catch (err) {
    summary.errors.push(`copywriter: ${err.message}`);
  }

  try {
    const f = await runFollowUpBatch(followUpLimit);
    summary.follow_ups = f.drafted;
  } catch (err) {
    summary.errors.push(`follow-ups: ${err.message}`);
  }

  await logAgentRun({
    run_type: 'draft_generation',
    drafts_created: summary.drafted + summary.follow_ups,
    errors: summary.errors.length ? summary.errors.join('; ') : null,
  }).catch(() => {});

  return summary;
}

module.exports = { runPipeline };
