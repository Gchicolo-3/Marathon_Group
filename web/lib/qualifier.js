// Scoring v2. A deal is scored out of 10 from five parts:
//
//   from the model (reads ICP.md):   segment 0-3, title fit 0-2, geography 0-1
//   from the database (no model):    signal 0-3 (sourced AND fresh), contact 0-1 (verified email)
//
// Per Mike's rule a target must hit ALL FOUR gates to be qualified:
//   1. segment    in one of the three ICP segments
//   2. geography  NJ or NY
//   3. signal     a sourced trigger event within the last 90 days
//   4. title      a title that hires an owner's rep (title fit >= 1)
// The model never sees or sets the signal or contact points, so a draft can
// not be lifted by an invented news item or an unchecked email.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const CWD_SKILLS = path.join(process.cwd(), 'lib', 'skills');
const SKILLS_DIR = fs.existsSync(CWD_SKILLS) ? CWD_SKILLS : path.join(__dirname, 'skills');

const QUALIFY_THRESHOLD = 6;
const SIGNAL_WINDOW_DAYS = 90;
const SEGMENTS = ['health', 'university', 'private_growth'];

let client;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic();
  }
  return client;
}

// Model part. Returns { segment, title_fit, geo, notes }.
async function assessProspect(prospect) {
  const ICP = fs.readFileSync(path.join(SKILLS_DIR, 'ICP.md'), 'utf8');

  const prompt = `You are a qualification agent for Marathon Group LLC.

Here is the ideal client profile:
${ICP}

Assess this prospect. Judge ONLY what the profile text and prospect details support. Do not guess about news or email quality, those are checked elsewhere.

Prospect:
Name: ${prospect.first_name} ${prospect.last_name}
Title: ${prospect.title}
Company: ${prospect.company}
Industry: ${prospect.industry}
Location: ${prospect.location}

Return ONLY valid JSON with no extra text:
{
  "segment": "health" | "university" | "private_growth" | "none",
  "title_fit": 0 | 1 | 2,
  "geo": "NJ_NY" | "other" | "unknown",
  "notes": "one or two sentences on the call"
}

segment: health = small to mid size medical or health providers. university = universities. private_growth = mid size private companies that are growing. none = anything else, including large hospital systems and public institutions if the profile excludes them.
title_fit: 2 = a title that directly hires an owner's rep (facilities, capital projects, real estate, COO, CFO). 1 = plausible influencer. 0 = unlikely to own the decision.
geo: NJ_NY only when the organization is clearly in New Jersey or New York.`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });
  const clean = response.content[0].text.replace(/```json|```/g, '').trim();
  const out = JSON.parse(clean);
  return {
    segment: SEGMENTS.includes(out.segment) ? out.segment : 'none',
    title_fit: [0, 1, 2].includes(out.title_fit) ? out.title_fit : 0,
    geo: ['NJ_NY', 'other', 'unknown'].includes(out.geo) ? out.geo : 'unknown',
    notes: out.notes || '',
  };
}

// Pure function: model assessment + database facts -> score and gates.
function computeScore(model, facts) {
  const segment_pts = model.segment === 'none' ? 0 : 3;
  const title_pts = model.title_fit;
  const geo_pts = model.geo === 'NJ_NY' ? 1 : 0;
  const signal_pts = facts.sourced_signals_90d >= 2 ? 3 : facts.sourced_signals_90d === 1 ? 2 : 0;
  const contact_pts = facts.email_verified ? 1 : 0;
  const score = segment_pts + title_pts + geo_pts + signal_pts + contact_pts;

  const gates = {
    segment: model.segment !== 'none',
    geography: model.geo === 'NJ_NY',
    signal: facts.sourced_signals_90d >= 1,
    title: model.title_fit >= 1,
  };
  const passed = Object.values(gates).every(Boolean);
  return {
    score,
    gates,
    passed,
    parts: { segment: segment_pts, title: title_pts, geography: geo_pts, signal: signal_pts, contact: contact_pts },
  };
}

async function loadFacts(dealId) {
  const db = require('./db');
  const r = await db.query(
    `SELECT
       (SELECT count(*) FROM trigger_events t
        WHERE t.company_id = d.company_id AND t.source_url IS NOT NULL AND t.source_url <> ''
          AND t.created_at > now() - ($2 || ' days')::interval)::int AS sourced_signals_90d,
       (c.email_status IN ('valid','manual')) AS email_verified
     FROM deals d JOIN contacts c ON c.id = d.contact_id
     WHERE d.id = $1`,
    [dealId, String(SIGNAL_WINDOW_DAYS)]
  );
  return r.rows[0] || { sourced_signals_90d: 0, email_verified: false };
}

// Scores one deal. The model part is cached in score_breakdown.model, so
// re-scoring after a new signal or a verified email costs no model call.
//   opts.refreshModel  force a fresh model call
//   opts.moveStage     apply the stage decision (default true; the rescore
//                      script passes false until the distribution is reviewed)
async function scoreDeal(dealId, { refreshModel = false, moveStage = true } = {}) {
  const db = require('./db');
  const q = require('./queries');

  const ctx = await q.getDraftContext(dealId);
  if (!ctx) return null;

  const existing = (await db.query(`SELECT score_breakdown, stage FROM deals WHERE id = $1`, [dealId])).rows[0];
  let model = existing?.score_breakdown?.model;
  if (!model || refreshModel) model = await assessProspect(ctx);

  const facts = await loadFacts(dealId);
  const result = computeScore(model, facts);
  const breakdown = { version: 2, model, facts, parts: result.parts, gates: result.gates, passed: result.passed };

  await db.query(
    `UPDATE deals SET score = $2, score_breakdown = $3::jsonb, scored_at = now(), updated_at = now() WHERE id = $1`,
    [dealId, result.score, JSON.stringify(breakdown)]
  );
  if (model.segment !== 'none') {
    await db.query(`UPDATE companies SET segment = $2 WHERE id = (SELECT company_id FROM deals WHERE id = $1)`, [dealId, model.segment]);
  }

  // Stage decision. Clearly out of ICP (wrong segment or region) is lost.
  // Missing signal or a weak title is parked in New and re-checked when a
  // sourced signal arrives. Only a deal that clears all four gates and the
  // score threshold becomes Qualified.
  let stage = existing?.stage || 'new';
  if (moveStage && ['new', 'qualified'].includes(stage)) {
    if (result.passed && result.score >= QUALIFY_THRESHOLD) stage = 'qualified';
    else if (model.segment === 'none' || model.geo === 'other') stage = 'lost';
    else stage = 'new';
    if (stage !== existing.stage) await q.setDealStage(dealId, stage);
  }

  const failed = Object.entries(result.gates).filter(([, ok]) => !ok).map(([g]) => g);
  await q.logActivity(
    dealId,
    'note',
    `AI qualification v2: score ${result.score}/10. ${result.passed ? 'All four gates passed.' : `Missing: ${failed.join(', ')}.`} ${model.notes}`.trim()
  );

  return { deal_id: dealId, score: result.score, passed: result.passed, gates: result.gates, stage, notes: model.notes };
}

// Kept for callers that score a plain prospect object.
async function qualifyProspect(prospect) {
  const m = await assessProspect(prospect);
  return { score: m.segment === 'none' ? 1 : 5 + m.title_fit, notes: m.notes };
}

async function qualifyDeal(dealId) {
  return scoreDeal(dealId, { refreshModel: false });
}

// Batch: deals never scored, plus parked deals that have gained a sourced
// signal since they were last scored.
async function runQualifierBatch(limit = 10) {
  const db = require('./db');
  const rows = (
    await db.query(
      `SELECT d.id FROM deals d
       WHERE d.stage = 'new'
         AND (d.scored_at IS NULL
              OR EXISTS (SELECT 1 FROM trigger_events t
                         WHERE t.company_id = d.company_id AND t.source_url IS NOT NULL
                           AND t.created_at > d.scored_at))
       ORDER BY d.id LIMIT $1`,
      [limit]
    )
  ).rows;

  const results = [];
  for (const row of rows) results.push(await scoreDeal(row.id));
  return {
    success: true,
    scored: results.length,
    qualified: results.filter((r) => r && r.stage === 'qualified').length,
  };
}

module.exports = {
  qualifyProspect, qualifyDeal, scoreDeal, runQualifierBatch, computeScore, assessProspect,
  QUALIFY_THRESHOLD, SIGNAL_WINDOW_DAYS,
};
