require('dotenv').config();
const db = require('../db/client');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
const ICP = fs.readFileSync(path.join(__dirname, '../skills/ICP.md'), 'utf8');

async function qualifyProspect(prospect) {
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
  console.log('Qualifier: starting...');
  try {
    const result = await db.query(
      `SELECT * FROM prospects WHERE status = 'new' LIMIT 20`
    );
    const prospects = result.rows;
    console.log(`Qualifier: found ${prospects.length} prospects to qualify`);

    let qualified = 0;
    let skipped = 0;

    for (const prospect of prospects) {
      const { score, notes } = await qualifyProspect(prospect);
      const newStatus = score >= 6 ? 'qualified' : 'disqualified';

      await db.query(
        `UPDATE prospects SET qualification_score=$1, qualification_notes=$2, status=$3 WHERE id=$4`,
        [score, notes, newStatus, prospect.id]
      );

      await db.query(
        `INSERT INTO activity_log (prospect_id, activity_type, notes) VALUES ($1,$2,$3)`,
        [prospect.id, 'qualified', `Score: ${score}. ${notes}`]
      );

      if (score >= 6) qualified++;
      else skipped++;
    }

    console.log(`Qualifier: ${qualified} qualified, ${skipped} skipped`);
    return { success: true, qualified, skipped };
  } catch (err) {
    console.error('Qualifier error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { run };
