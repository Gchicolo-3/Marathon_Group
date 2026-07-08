// All SQL for the CRM lives here. Schema (created by scripts/migrate-001-crm.js):
//   companies(id, name, industry, notes, created_at)
//   contacts(id, company_id, name, title, email, phone, linkedin_url, created_at)
//   deals(id, contact_id, company_id, score, stage deal_stage, source, created_at, updated_at)
//   email_drafts(id, deal_id, subject, body, status, ai_generated_at, edited_at)
//   activities(id, deal_id, type activity_kind, content, created_at)
const db = require('./db');

const STAGES = ['new', 'qualified', 'contacted', 'replied', 'meeting_set', 'won', 'lost'];
const ACTIVITY_TYPES = ['note', 'stage_change', 'email_sent', 'ai_regenerate'];

// Latest draft per deal — regenerate inserts new versions, highest id wins.
const LATEST_DRAFT = `
  SELECT DISTINCT ON (deal_id) id, deal_id, subject, body, status, ai_generated_at, edited_at
  FROM email_drafts
  ORDER BY deal_id, id DESC
`;

/* ------------------------------ companies ------------------------------ */

async function listCompanies() {
  const r = await db.query(
    `SELECT co.*,
            (SELECT count(*) FROM contacts c WHERE c.company_id = co.id)::int AS contact_count,
            (SELECT count(*) FROM deals d WHERE d.company_id = co.id)::int AS deal_count
     FROM companies co
     ORDER BY co.name`
  );
  return r.rows;
}

async function getCompany(id) {
  const r = await db.query(`SELECT * FROM companies WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function createCompany({ name, industry, notes }) {
  const r = await db.query(
    `INSERT INTO companies (name, industry, notes) VALUES ($1, $2, $3) RETURNING *`,
    [name, industry ?? null, notes ?? null]
  );
  return r.rows[0];
}

async function updateCompany(id, { name, industry, notes }) {
  const r = await db.query(
    `UPDATE companies
     SET name = COALESCE($2, name),
         industry = COALESCE($3, industry),
         notes = COALESCE($4, notes)
     WHERE id = $1 RETURNING *`,
    [id, name ?? null, industry ?? null, notes ?? null]
  );
  return r.rows[0] || null;
}

async function deleteCompany(id) {
  const r = await db.query(`DELETE FROM companies WHERE id = $1 RETURNING id`, [id]);
  return r.rows[0] || null;
}

/* ------------------------------ contacts ------------------------------- */

async function listContacts() {
  const r = await db.query(
    `SELECT c.*, co.name AS company_name
     FROM contacts c
     JOIN companies co ON co.id = c.company_id
     ORDER BY c.name`
  );
  return r.rows;
}

async function getContact(id) {
  const r = await db.query(
    `SELECT c.*, co.name AS company_name
     FROM contacts c JOIN companies co ON co.id = c.company_id
     WHERE c.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function createContact({ company_id, name, title, email, phone, linkedin_url }) {
  const r = await db.query(
    `INSERT INTO contacts (company_id, name, title, email, phone, linkedin_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [company_id, name, title ?? null, email ?? null, phone ?? null, linkedin_url ?? null]
  );
  return r.rows[0];
}

async function updateContact(id, fields) {
  const r = await db.query(
    `UPDATE contacts
     SET company_id = COALESCE($2, company_id),
         name = COALESCE($3, name),
         title = COALESCE($4, title),
         email = COALESCE($5, email),
         phone = COALESCE($6, phone),
         linkedin_url = COALESCE($7, linkedin_url)
     WHERE id = $1 RETURNING *`,
    [
      id,
      fields.company_id ?? null,
      fields.name ?? null,
      fields.title ?? null,
      fields.email ?? null,
      fields.phone ?? null,
      fields.linkedin_url ?? null,
    ]
  );
  return r.rows[0] || null;
}

async function deleteContact(id) {
  const r = await db.query(`DELETE FROM contacts WHERE id = $1 RETURNING id`, [id]);
  return r.rows[0] || null;
}

/* -------------------------------- deals -------------------------------- */

async function listDeals() {
  const r = await db.query(
    `SELECT d.id, d.score, d.stage, d.source, d.campaign_week, d.created_at, d.updated_at,
            c.id AS contact_id, c.name AS contact_name, c.title AS contact_title,
            c.email AS contact_email,
            co.id AS company_id, co.name AS company_name, co.industry,
            e.id AS draft_id, e.subject AS draft_subject, e.status AS draft_status
     FROM deals d
     JOIN contacts c ON c.id = d.contact_id
     JOIN companies co ON co.id = d.company_id
     LEFT JOIN (${LATEST_DRAFT}) e ON e.deal_id = d.id
     ORDER BY d.score DESC NULLS LAST, d.id`
  );
  return r.rows;
}

async function getDeal(id) {
  const r = await db.query(
    `SELECT d.id, d.score, d.stage, d.source, d.campaign_week, d.created_at, d.updated_at,
            c.id AS contact_id, c.name AS contact_name, c.title AS contact_title,
            c.email AS contact_email, c.phone AS contact_phone,
            c.linkedin_url AS contact_linkedin_url,
            co.id AS company_id, co.name AS company_name, co.industry,
            co.notes AS company_notes,
            e.id AS draft_id, e.subject AS draft_subject, e.body AS draft_body,
            e.status AS draft_status, e.ai_generated_at AS draft_ai_generated_at,
            e.edited_at AS draft_edited_at
     FROM deals d
     JOIN contacts c ON c.id = d.contact_id
     JOIN companies co ON co.id = d.company_id
     LEFT JOIN (${LATEST_DRAFT}) e ON e.deal_id = d.id
     WHERE d.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function createDeal({ contact_id, company_id, score, stage, source }) {
  const r = await db.query(
    `INSERT INTO deals (contact_id, company_id, score, stage, source)
     VALUES ($1, $2, $3, COALESCE($4, 'new')::deal_stage, $5) RETURNING *`,
    [contact_id, company_id, score ?? null, stage ?? null, source ?? null]
  );
  return r.rows[0];
}

async function updateDeal(id, { score, source }) {
  const r = await db.query(
    `UPDATE deals
     SET score = COALESCE($2, score),
         source = COALESCE($3, source),
         updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, score ?? null, source ?? null]
  );
  return r.rows[0] || null;
}

async function deleteDeal(id) {
  const r = await db.query(`DELETE FROM deals WHERE id = $1 RETURNING id`, [id]);
  return r.rows[0] || null;
}

// Moves a deal to a new stage and logs a stage_change activity.
async function setDealStage(id, stage) {
  const current = await db.query(`SELECT stage FROM deals WHERE id = $1`, [id]);
  if (!current.rows[0]) return null;
  const from = current.rows[0].stage;

  const r = await db.query(
    `UPDATE deals SET stage = $2::deal_stage, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, stage]
  );
  await logActivity(id, 'stage_change', `Stage changed: ${from} → ${stage}`);
  return r.rows[0];
}

// Prospect-shaped context for the copywriter (location / qualification notes
// come from the legacy prospects table when a match exists).
async function getDraftContext(dealId) {
  const r = await db.query(
    `SELECT d.id AS deal_id,
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
     WHERE d.id = $1`,
    [dealId]
  );
  return r.rows[0] || null;
}

/* ------------------------------ activities ----------------------------- */

async function logActivity(dealId, type, content) {
  const r = await db.query(
    `INSERT INTO activities (deal_id, type, content) VALUES ($1, $2::activity_kind, $3)
     RETURNING *`,
    [dealId, type, content]
  );
  return r.rows[0];
}

async function listActivities(dealId) {
  const r = await db.query(
    `SELECT * FROM activities WHERE deal_id = $1 ORDER BY created_at DESC, id DESC`,
    [dealId]
  );
  return r.rows;
}

/* ------------------------------ agent runs ----------------------------- */

async function listAgentRuns(limit = 50) {
  const r = await db.query(
    `SELECT * FROM agent_runs ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit]
  );
  return r.rows;
}

async function logAgentRun({ run_type, prospects_found = 0, drafts_created = 0, errors = null, notes = null }) {
  // The notes column arrives with migration 003 — leave it out of the insert
  // until it's needed so logging keeps working on a pre-003 database.
  if (notes == null) {
    const r = await db.query(
      `INSERT INTO agent_runs (run_type, prospects_found, drafts_created, errors)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [run_type, prospects_found, drafts_created, errors]
    );
    return r.rows[0];
  }
  const r = await db.query(
    `INSERT INTO agent_runs (run_type, prospects_found, drafts_created, errors, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [run_type, prospects_found, drafts_created, errors, notes]
  );
  return r.rows[0];
}

/* ---------------------------- trigger events ---------------------------- */
// trigger_events and agent_runs.notes ship with migration 003. Reads degrade
// to empty results on a pre-003 database instead of taking the page down.

async function listTriggerEvents(limit = 100) {
  try {
    const r = await db.query(
      `SELECT t.*, co.name AS company_name
       FROM trigger_events t
       LEFT JOIN companies co ON co.id = t.company_id
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT $1`,
      [limit]
    );
    return r.rows;
  } catch (err) {
    console.error('listTriggerEvents:', err.message);
    return [];
  }
}

/* ---------------------------- activity feed ----------------------------- */

// Cross-deal audit trail: per-deal activities (with who they're about)
// interleaved with agent runs, newest first. Morning-brief rows are shown in
// their own homepage panel, not the feed.
async function listActivityFeed(limit = 100) {
  const r = await db.query(
    `SELECT 'activity' AS kind, a.id, a.type::text AS type, a.content AS notes,
            a.created_at, a.deal_id, c.name AS contact_name, co.name AS company_name,
            NULL::int AS prospects_found, NULL::int AS drafts_created, NULL::text AS errors
     FROM activities a
     JOIN deals d ON d.id = a.deal_id
     JOIN contacts c ON c.id = d.contact_id
     JOIN companies co ON co.id = d.company_id
     UNION ALL
     SELECT 'agent_run', r.id, r.run_type, NULL, r.created_at, NULL, NULL, NULL,
            r.prospects_found, r.drafts_created, r.errors
     FROM agent_runs r
     WHERE r.run_type <> 'morning_brief'
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [limit]
  );
  return r.rows;
}

/* ----------------------------- morning brief ---------------------------- */

async function getLatestBrief() {
  try {
    const r = await db.query(
      `SELECT notes, created_at FROM agent_runs
       WHERE run_type = 'morning_brief' AND notes IS NOT NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    );
    return r.rows[0] || null;
  } catch (err) {
    console.error('getLatestBrief:', err.message);
    return null;
  }
}

/* ---------------------------- pipeline stats ---------------------------- */

// The four homepage stat cards. "Prospects" are deals (one deal per
// prospect in this CRM); "active sequences" are deals mid-campaign in
// Contacted; signals fall back to 0 pre-migration-003.
async function getPipelineStats() {
  const r = await db.query(
    `SELECT
       (SELECT count(*) FROM deals)::int AS total_prospects,
       (SELECT count(*) FROM deals d
        WHERE (SELECT e.status FROM email_drafts e WHERE e.deal_id = d.id ORDER BY e.id DESC LIMIT 1) = 'pending')::int AS pending_approval,
       (SELECT count(*) FROM deals WHERE stage = 'contacted')::int AS active_sequences`
  );
  let signals_week = 0;
  try {
    const s = await db.query(
      `SELECT count(*)::int AS n FROM trigger_events WHERE created_at > now() - interval '7 days'`
    );
    signals_week = s.rows[0].n;
  } catch (err) {
    console.error('getPipelineStats signals:', err.message);
  }
  return { ...r.rows[0], signals_week };
}

/* -------------------------------- drafts ------------------------------- */

async function getLatestDraft(dealId) {
  const r = await db.query(
    `SELECT * FROM email_drafts WHERE deal_id = $1 ORDER BY id DESC LIMIT 1`,
    [dealId]
  );
  return r.rows[0] || null;
}

async function updateDraft(dealId, { subject, body }) {
  const r = await db.query(
    `UPDATE email_drafts
     SET subject = $2, body = $3, edited_at = now()
     WHERE id = (SELECT id FROM email_drafts WHERE deal_id = $1 ORDER BY id DESC LIMIT 1)
     RETURNING *`,
    [dealId, subject, body]
  );
  return r.rows[0] || null;
}

async function setDraftStatus(dealId, status) {
  const r = await db.query(
    `UPDATE email_drafts
     SET status = $2
     WHERE id = (SELECT id FROM email_drafts WHERE deal_id = $1 ORDER BY id DESC LIMIT 1)
     RETURNING *`,
    [dealId, status]
  );
  return r.rows[0] || null;
}

// Regenerate inserts a NEW draft row (version history preserved), tagged
// with the deal's current campaign week.
async function insertDraft(dealId, { subject, body }) {
  const r = await db.query(
    `INSERT INTO email_drafts (deal_id, subject, body, status, ai_generated_at, campaign_week)
     VALUES ($1, $2, $3, 'pending', now(),
             (SELECT campaign_week FROM deals WHERE id = $1))
     RETURNING *`,
    [dealId, subject, body]
  );
  return r.rows[0];
}

module.exports = {
  STAGES,
  ACTIVITY_TYPES,
  listCompanies, getCompany, createCompany, updateCompany, deleteCompany,
  listContacts, getContact, createContact, updateContact, deleteContact,
  listDeals, getDeal, createDeal, updateDeal, deleteDeal, setDealStage, getDraftContext,
  logActivity, listActivities, listAgentRuns, logAgentRun,
  listTriggerEvents, listActivityFeed, getLatestBrief, getPipelineStats,
  getLatestDraft, updateDraft, setDraftStatus, insertDraft,
};
