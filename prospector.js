require('dotenv').config();
const axios = require('axios');
const db = require('../db/client');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const ICP = fs.readFileSync(path.join(__dirname, '../skills/ICP.md'), 'utf8');
const MISSION = fs.readFileSync(path.join(__dirname, '../skills/MISSION.md'), 'utf8');

async function searchProspects() {
  const prompt = `You are a research agent for Marathon Group LLC.

Here is the mission context:
${MISSION}

Here is the ideal client profile:
${ICP}

Search for 10 real potential prospects that match this ICP exactly.
Focus on healthcare and education contacts in NJ, NY, CT, PA.
Target titles: VP of Facilities, Director of Capital Projects, Director of Campus Operations,
SVP Real Estate, COO, CFO at private hospitals, health systems, and private universities.

Return ONLY a valid JSON array with no extra text. Each object must have:
{
  "first_name": "",
  "last_name": "",
  "title": "",
  "company": "",
  "industry": "healthcare" or "education",
  "location": "",
  "email": "",
  "linkedin_url": ""
}

Use your knowledge of real organizations in these verticals in the tri-state area.
Leave email blank if unknown. Only include real organizations.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function saveProspects(prospects) {
  let saved = 0;
  for (const p of prospects) {
    try {
      await db.query(
        `INSERT INTO prospects (first_name, last_name, title, company, industry, location, email, linkedin_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT DO NOTHING`,
        [p.first_name, p.last_name, p.title, p.company, p.industry, p.location, p.email || null, p.linkedin_url || null]
      );
      saved++;
    } catch (err) {
      console.error(`Failed to save prospect ${p.first_name} ${p.last_name}:`, err.message);
    }
  }
  return saved;
}

async function run() {
  console.log('Prospector: starting...');
  try {
    const prospects = await searchProspects();
    console.log(`Prospector: found ${prospects.length} prospects`);
    const saved = await saveProspects(prospects);
    console.log(`Prospector: saved ${saved} new prospects`);
    return { success: true, found: prospects.length, saved };
  } catch (err) {
    console.error('Prospector error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { run };
