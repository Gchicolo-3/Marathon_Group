require('dotenv').config();
const db = require('../db/client');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
const VOICE = fs.readFileSync(path.join(__dirname, '../skills/VOICE.md'), 'utf8');
const CAMPAIGN = fs.readFileSync(path.join(__dirname, '../skills/CAMPAIGN.md'), 'utf8');
const MISSION = fs.readFileSync(path.join(__dirname, '../skills/MISSION.md'), 'utf8');

async function draftEmail(prospect) {
  const prompt = `You are the copywriter agent for Marathon Group LLC.

Here is Michael's voice guide:
${VOICE}

Here is the campaign framework:
${CAMPAIGN}

Here is the mission context:
${MISSION}

Write a week 1 cold outreach email to this prospect.
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

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function run() {
  console.log('Copywriter: starting...');
  try {
    const result = await db.query(
      `SELECT * FROM prospects WHERE status = 'qualified'
       AND id NOT IN (SELECT prospect_id FROM email_drafts WHERE prospect_id IS NOT NULL)
       LIMIT 10`
    );
    const prospects = result.rows;
    console.log(`Copywriter: drafting emails for ${prospects.length} prospects`);

    let drafted = 0;
    for (const prospect of prospects) {
      const { subject, body } = await draftEmail(prospect);

      await db.query(
        `INSERT INTO email_drafts (prospect_id, subject, body, status, campaign_week)
         VALUES ($1,$2,$3,'pending',1)`,
        [prospect.id, subject, body]
      );

      await db.query(
        `UPDATE prospects SET status='emailed' WHERE id=$1`,
        [prospect.id]
      );

      await db.query(
        `INSERT INTO activity_log (prospect_id, activity_type, notes) VALUES ($1,$2,$3)`,
        [prospect.id, 'email_drafted', `Subject: ${subject}`]
      );

      drafted++;
    }

    console.log(`Copywriter: drafted ${drafted} emails`);
    return { success: true, drafted };
  } catch (err) {
    console.error('Copywriter error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { run };
