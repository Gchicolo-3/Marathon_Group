// Single source of truth for how Marathon Group outreach emails get drafted.
// Used by:
//   - the batch pipeline (root copywriter.js / orchestrator.js)
//   - POST /api/deals/[id]/regenerate in the CRM
// Same prompt, same model, same parsing everywhere.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// Inside Next.js the module is bundled and __dirname points into .next/ —
// resolve from the project root there; plain node (root pipeline scripts)
// resolves relative to this file.
const CWD_SKILLS = path.join(process.cwd(), 'lib', 'skills');
const SKILLS_DIR = fs.existsSync(CWD_SKILLS) ? CWD_SKILLS : path.join(__dirname, 'skills');

function readSkill(name) {
  return fs.readFileSync(path.join(SKILLS_DIR, name), 'utf8');
}

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

// Drafts a campaign email for a prospect/deal-like object with
// { first_name, last_name, title, company, industry, location,
//   qualification_notes }. Week 1 is the cold intro; later weeks follow the
// 26-week campaign framework's track topics. Returns { subject, body }.
async function draftEmail(prospect, week = 1) {
  const VOICE = readSkill('VOICE.md');
  const CAMPAIGN = readSkill('CAMPAIGN.md');
  const MISSION = readSkill('MISSION.md');

  const assignment =
    week <= 1
      ? 'Write a week 1 cold outreach email to this prospect.'
      : `Write the week ${week} email of the campaign to this prospect.
Pick the angle the campaign framework prescribes for week ${week}, using the
track topics that match the prospect's industry. This is a follow-up — they
have not replied yet, so bring a fresh hook, never reference or apologize for
earlier emails, and keep the ask low-pressure.`;

  const prompt = `You are the copywriter agent for Marathon Group LLC.

Here is Michael's voice guide:
${VOICE}

Here is the campaign framework:
${CAMPAIGN}

Here is the mission context:
${MISSION}

${assignment}
Follow Michael's voice exactly. Short, direct, human, no fluff.

Prospect:
Name: ${prospect.first_name} ${prospect.last_name}
Title: ${prospect.title}
Company: ${prospect.company}
Industry: ${prospect.industry}
Location: ${prospect.location}
Qualification notes: ${prospect.qualification_notes}

Return ONLY valid JSON with no extra text:
{
  "subject": "email subject line",
  "body": "full email body text"
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

// Batch run: draft emails for every deal in stage 'qualified' that has no
// draft yet. Used by the root orchestrator; the CRM regenerate route calls
// draftEmail directly.
async function runBatch(limit = 10) {
  const db = require('./db');
  const result = await db.query(
    `SELECT d.id AS deal_id,
            split_part(c.name, ' ', 1) AS first_name,
            NULLIF(substr(c.name, strpos(c.name, ' ') + 1), c.name) AS last_name,
            c.name AS contact_name,
            c.title,
            co.name AS company,
            co.industry,
            p.location,
            p.qualification_notes
     FROM deals d
     JOIN contacts c ON c.id = d.contact_id
     JOIN companies co ON co.id = d.company_id
     LEFT JOIN prospects p ON trim(p.first_name || ' ' || p.last_name) = c.name
     WHERE d.stage = 'qualified'
       AND NOT EXISTS (SELECT 1 FROM email_drafts e WHERE e.deal_id = d.id)
     LIMIT $1`,
    [limit]
  );

  let drafted = 0;
  for (const row of result.rows) {
    const { subject, body } = await draftEmail(row);
    await db.query(
      `INSERT INTO email_drafts (deal_id, subject, body, status, ai_generated_at, campaign_week)
       VALUES ($1, $2, $3, 'pending', now(), 1)`,
      [row.deal_id, subject, body]
    );
    await db.query(
      `INSERT INTO activities (deal_id, type, content)
       VALUES ($1, 'ai_regenerate', $2)`,
      [row.deal_id, `Initial draft generated: "${subject}"`]
    );
    drafted++;
  }
  return { success: true, drafted };
}

// Campaign follow-ups: for contacted deals whose latest email was SENT 7+
// days ago and that haven't finished the 26-week sequence, advance the
// campaign week and draft the next email (lands in the approval queue as
// pending). Replied/meeting_set/won/lost deals are out of the sequence.
async function runFollowUpBatch(limit = 5) {
  const db = require('./db');
  const result = await db.query(
    `SELECT d.id AS deal_id,
            d.campaign_week,
            split_part(c.name, ' ', 1) AS first_name,
            NULLIF(substr(c.name, strpos(c.name, ' ') + 1), c.name) AS last_name,
            c.title,
            co.name AS company,
            co.industry,
            p.location,
            p.qualification_notes
     FROM deals d
     JOIN contacts c ON c.id = d.contact_id
     JOIN companies co ON co.id = d.company_id
     LEFT JOIN prospects p ON trim(p.first_name || ' ' || p.last_name) = c.name
     WHERE d.stage = 'contacted'
       AND d.campaign_week < 26
       AND (SELECT e.status FROM email_drafts e
            WHERE e.deal_id = d.id ORDER BY e.id DESC LIMIT 1) = 'sent'
       AND (SELECT max(a.created_at) FROM activities a
            WHERE a.deal_id = d.id AND a.type = 'email_sent') < now() - interval '7 days'
     ORDER BY d.campaign_week, d.id
     LIMIT $1`,
    [limit]
  );

  let drafted = 0;
  for (const row of result.rows) {
    const week = row.campaign_week + 1;
    const { subject, body } = await draftEmail(row, week);
    await db.query(
      `INSERT INTO email_drafts (deal_id, subject, body, status, ai_generated_at, campaign_week)
       VALUES ($1, $2, $3, 'pending', now(), $4)`,
      [row.deal_id, subject, body, week]
    );
    await db.query(
      `UPDATE deals SET campaign_week = $2, updated_at = now() WHERE id = $1`,
      [row.deal_id, week]
    );
    await db.query(
      `INSERT INTO activities (deal_id, type, content)
       VALUES ($1, 'ai_regenerate', $2)`,
      [row.deal_id, `Week ${week} follow-up drafted: "${subject}"`]
    );
    drafted++;
  }
  return { success: true, drafted };
}

module.exports = { draftEmail, runBatch, runFollowUpBatch };
