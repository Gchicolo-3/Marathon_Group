// Prospector agent — two-step flow so prospects are real, current people
// instead of model hallucinations:
//   1. Perplexity (live web search) finds named contacts at healthcare and
//      education organizations in NJ/NY/CT/PA matching the ICP, excluding
//      organizations already in the pipeline.
//   2. Claude parses the raw search results into the structured JSON array
//      the database expects.
// New prospects land as companies/contacts/deals (stage 'new', source
// 'ai_prospector') so the qualifier picks them up on the same run; a row is
// also written to the legacy prospects table, which the qualifier and
// copywriter join on for location context.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const perplexity = require('./perplexity');

const CWD_SKILLS = path.join(process.cwd(), 'lib', 'skills');
const SKILLS_DIR = fs.existsSync(CWD_SKILLS) ? CWD_SKILLS : path.join(__dirname, 'skills');

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

// Step 1: live web search for real named contacts. The exclusion list keeps
// each run from re-surfacing organizations already in the pipeline.
async function searchRawProspects(count, excludeCompanies) {
  const ICP = fs.readFileSync(path.join(SKILLS_DIR, 'ICP.md'), 'utf8');

  const exclusions = excludeCompanies.length
    ? `\nDo NOT include anyone from these organizations (already in our pipeline):\n${excludeCompanies.map((c) => `- ${c}`).join('\n')}\n`
    : '';

  return perplexity.search(`Find ${count} real, currently-employed people who match this ideal client profile:

${ICP}

Search for named contacts at private hospital systems, health networks, medical centers, private universities, independent schools, and religious institutions in New Jersey, New York, Connecticut, and Pennsylvania.
Target titles: VP of Facilities, Director of Capital Projects, Director of Campus Operations, SVP Real Estate, COO, CFO.
${exclusions}
For each person report: full name, exact title, organization, whether the organization is healthcare or education, city/state, LinkedIn profile URL if you can find one, and work email if publicly listed. Only include people you actually found in current public sources — never invent names.`);
}

// Step 2: Claude turns the raw search results into the structured array the
// DB expects. Anyone the search didn't clearly name gets dropped here.
async function parseProspects(rawResults) {
  const prompt = `You are a data-extraction agent for Marathon Group LLC.

Below are raw web-search results listing potential prospects. Extract every clearly-named person into a structured record. Do not invent or embellish anything — if a field is not in the results, leave it as an empty string. Drop entries that don't name a specific person.

Search results:
${rawResults}

Return ONLY a valid JSON array with no extra text. Each object must have exactly:
{
  "first_name": "",
  "last_name": "",
  "title": "",
  "company": "",
  "industry": "healthcare" or "education",
  "location": "",
  "email": "",
  "linkedin_url": ""
}`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  const prospects = JSON.parse(clean);
  if (!Array.isArray(prospects)) {
    throw new Error('Prospect parse did not return a JSON array');
  }
  return prospects.filter((p) => p.first_name && p.company);
}

// Saves a parsed prospect into the CRM model (company -> contact -> deal in
// stage 'new') plus the legacy prospects table. Skips contacts we already
// have. Returns true when a new deal was created.
async function saveProspect(db, p) {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();

  const company = await db.query(
    `INSERT INTO companies (name, industry)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET industry = COALESCE(companies.industry, EXCLUDED.industry)
     RETURNING id`,
    [p.company.trim(), p.industry || null]
  );
  const companyId = company.rows[0].id;

  const existing = await db.query(
    `SELECT id FROM contacts WHERE company_id = $1 AND lower(name) = lower($2)`,
    [companyId, name]
  );
  if (existing.rows.length > 0) return false;

  const contact = await db.query(
    `INSERT INTO contacts (company_id, name, title, email, linkedin_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [companyId, name, p.title || null, p.email || null, p.linkedin_url || null]
  );

  await db.query(
    `INSERT INTO deals (contact_id, company_id, stage, source)
     VALUES ($1, $2, 'new', 'ai_prospector')`,
    [contact.rows[0].id, companyId]
  );

  // Legacy prospects row keeps location available to the qualifier and
  // copywriter, which join prospects by contact name.
  await db.query(
    `INSERT INTO prospects (first_name, last_name, title, company, industry, location, email, linkedin_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT DO NOTHING`,
    [p.first_name, p.last_name, p.title || null, p.company, p.industry || null,
     p.location || null, p.email || null, p.linkedin_url || null]
  );

  return true;
}

// Batch run: search -> parse -> save. Returns { success, found, saved }.
async function runProspectorBatch(count = 10) {
  const db = require('./db');

  const existing = await db.query(`SELECT name FROM companies ORDER BY name`);
  const raw = await searchRawProspects(count, existing.rows.map((r) => r.name));
  const prospects = await parseProspects(raw);

  let saved = 0;
  for (const p of prospects) {
    try {
      if (await saveProspect(db, p)) saved++;
    } catch (err) {
      console.error(`Prospector: failed to save ${p.first_name} ${p.last_name}:`, err.message);
    }
  }
  return { success: true, found: prospects.length, saved };
}

module.exports = { runProspectorBatch, searchRawProspects, parseProspects };
