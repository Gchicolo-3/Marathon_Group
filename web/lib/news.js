// News agent — finds trigger events (the "why now" for outreach) for
// organizations already in the pipeline. Same two-step pattern as the
// prospector: Perplexity searches live news, Claude parses the results into
// structured rows for the trigger_events table (shown on /signals).
const Anthropic = require('@anthropic-ai/sdk');
const perplexity = require('./perplexity');

// Mirrors the ICP's "High Priority Trigger Events" section.
const EVENT_TYPES = [
  'capital_project', 'funding', 'expansion', 'acquisition',
  'leadership_change', 'other',
];

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

async function searchNews(companies) {
  return perplexity.search(`Search for recent news (last 90 days) about these organizations:
${companies.map((c) => `- ${c.name}${c.industry ? ` (${c.industry})` : ''}`).join('\n')}

I only care about these trigger events:
- New capital project announced (construction, renovation, expansion)
- Bond or funding approval
- Facility expansion news
- New campus or building acquisition
- Leadership changes in facilities, real estate, operations, or finance roles

For each event found report: the organization, what happened, when, and the source. If you find nothing relevant for an organization, skip it — do not pad the list.`);
}

async function parseEvents(rawResults, companies) {
  const prompt = `You are a data-extraction agent for Marathon Group LLC, an owner's-representative / project-management firm serving healthcare and education organizations.

Below are raw news-search results about organizations in our sales pipeline. Extract each concrete trigger event. Do not invent events — only extract what the results actually report. Skip vague or irrelevant items.

Organizations we track: ${companies.map((c) => c.name).join(', ')}

Search results:
${rawResults}

Return ONLY a valid JSON array with no extra text. Each object must have exactly:
{
  "organization": "organization name, matching our list where possible",
  "event_type": one of ${JSON.stringify(EVENT_TYPES)},
  "description": "one or two sentences on what happened",
  "relevance": "one sentence on why this matters for Marathon Group's outreach",
  "source_url": ""
}`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  const events = JSON.parse(clean);
  if (!Array.isArray(events)) {
    throw new Error('News parse did not return a JSON array');
  }
  return events.filter((e) => e.organization && e.description);
}

// Scans the least-recently-scanned active companies (deals not won/lost) and
// stores new trigger events. Duplicate descriptions for the same org are
// skipped so re-runs don't stack repeats.
async function runNewsScan(limit = 5) {
  const db = require('./db');

  const companies = (
    await db.query(
      `SELECT co.id, co.name, co.industry,
              (SELECT max(t.created_at) FROM trigger_events t WHERE t.company_id = co.id) AS last_scan
       FROM companies co
       WHERE EXISTS (SELECT 1 FROM deals d
                     WHERE d.company_id = co.id AND d.stage NOT IN ('won','lost'))
       ORDER BY last_scan ASC NULLS FIRST, co.id
       LIMIT $1`,
      [limit]
    )
  ).rows;
  if (companies.length === 0) return { success: true, found: 0, saved: 0 };

  const raw = await searchNews(companies);
  const events = await parseEvents(raw, companies);

  const byName = new Map(companies.map((c) => [c.name.toLowerCase(), c.id]));
  let saved = 0;
  for (const e of events) {
    const companyId = byName.get((e.organization || '').toLowerCase().trim()) || null;
    const dupe = await db.query(
      `SELECT 1 FROM trigger_events
       WHERE lower(organization) = lower($1) AND description = $2`,
      [e.organization, e.description]
    );
    if (dupe.rows.length > 0) continue;

    await db.query(
      `INSERT INTO trigger_events (company_id, organization, event_type, description, relevance, source_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        companyId,
        e.organization,
        EVENT_TYPES.includes(e.event_type) ? e.event_type : 'other',
        e.description,
        e.relevance || null,
        e.source_url || null,
      ]
    );
    saved++;
  }
  return { success: true, found: events.length, saved };
}

module.exports = { runNewsScan, EVENT_TYPES };
