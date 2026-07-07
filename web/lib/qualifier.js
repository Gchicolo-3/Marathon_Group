// Single source of truth for how deals get qualified — the same prompt/model
// the pipeline Qualifier agent uses (ICP-based 1–10 scoring). Used by the
// morning cron batch and POST /api/deals/[id]/qualify.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const CWD_SKILLS = path.join(process.cwd(), 'lib', 'skills');
const SKILLS_DIR = fs.existsSync(CWD_SKILLS) ? CWD_SKILLS : path.join(__dirname, 'skills');

const QUALIFY_THRESHOLD = 6;

let client;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    client = new Anthropic();
  }
  return client;
}

// Scores a prospect/deal-like object ({ first_name, last_name, title,
// company, industry, location }) against the ICP. Returns { score, notes }.
async function qualifyProspect(prospect) {
  const ICP = fs.readFileSync(path.join(SKILLS_DIR, 'ICP.md'), 'utf8');

  const prompt = `You are a qualification agent for Marathon Group LLC.

Here is the ideal client profile:
${ICP}

Score this prospect from 1 to 10 based on fit with the ICP.
Consider their title, company, industry, and location.

Prospect:
Name: ${prospect.first_name} ${prospect.last_name}
Title: ${prospect.title}
Company: ${prospect.company}
Industry: ${prospect.industry}
Location: ${prospect.location}

Return ONLY valid JSON with no extra text:
{
  "score": 0,
  "notes": "brief reason for score"
}`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// Qualifies one deal: scores it, sets deals.score, moves the stage to
// qualified (score >= 6) or lost, and logs the reasoning as an activity.
async function qualifyDeal(dealId) {
  const db = require('./db');
  const q = require('./queries');

  const ctx = await q.getDraftContext(dealId); // same prospect-shaped context
  if (!ctx) return null;

  const { score, notes } = await qualifyProspect(ctx);
  const stage = score >= QUALIFY_THRESHOLD ? 'qualified' : 'lost';

  await db.query(
    `UPDATE deals SET score = $2, updated_at = now() WHERE id = $1`,
    [dealId, score]
  );
  await q.logActivity(dealId, 'note', `AI qualification: score ${score}/10 — ${notes}`);
  await q.setDealStage(dealId, stage);

  return { deal_id: dealId, score, notes, stage };
}

// Batch: qualify every deal still in stage 'new'.
async function runQualifierBatch(limit = 10) {
  const db = require('./db');
  const rows = (
    await db.query(`SELECT id FROM deals WHERE stage = 'new' ORDER BY id LIMIT $1`, [limit])
  ).rows;

  const results = [];
  for (const row of rows) {
    results.push(await qualifyDeal(row.id));
  }
  return {
    success: true,
    scored: results.length,
    qualified: results.filter((r) => r.stage === 'qualified').length,
  };
}

module.exports = { qualifyProspect, qualifyDeal, runQualifierBatch, QUALIFY_THRESHOLD };
