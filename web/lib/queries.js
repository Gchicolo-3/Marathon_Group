// All SQL for the dashboard lives here so column-name fixes after
// schema introspection only touch one file.
//
// Column names verified against the pipeline agents' queries:
//   prospects(id, first_name, last_name, title, company, industry, location,
//             email, linkedin_url, status, qualification_score, qualification_notes)
//   email_drafts(id, prospect_id, subject, body, status, campaign_week)
const db = require('./db');

// Latest draft per prospect (the copywriter only creates one per prospect,
// but DISTINCT ON keeps this correct if that ever changes).
const LATEST_DRAFT = `
  SELECT DISTINCT ON (prospect_id) id, prospect_id, subject, body, status, campaign_week
  FROM email_drafts
  ORDER BY prospect_id, id DESC
`;

async function listProspects() {
  const result = await db.query(
    `SELECT p.id,
            p.first_name,
            p.last_name,
            p.title,
            p.company,
            p.industry,
            p.location,
            p.email,
            p.status,
            p.qualification_score,
            d.id     AS draft_id,
            d.subject AS draft_subject,
            d.status  AS draft_status
     FROM prospects p
     LEFT JOIN (${LATEST_DRAFT}) d ON d.prospect_id = p.id
     ORDER BY p.qualification_score DESC NULLS LAST, p.id ASC`
  );
  return result.rows;
}

async function getProspect(id) {
  const result = await db.query(
    `SELECT p.id,
            p.first_name,
            p.last_name,
            p.title,
            p.company,
            p.industry,
            p.location,
            p.email,
            p.linkedin_url,
            p.status,
            p.qualification_score,
            p.qualification_notes,
            d.id      AS draft_id,
            d.subject AS draft_subject,
            d.body    AS draft_body,
            d.status  AS draft_status,
            d.campaign_week
     FROM prospects p
     LEFT JOIN (${LATEST_DRAFT}) d ON d.prospect_id = p.id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateDraft(prospectId, { subject, body }) {
  const result = await db.query(
    `UPDATE email_drafts
     SET subject = $2, body = $3
     WHERE id = (
       SELECT id FROM email_drafts WHERE prospect_id = $1 ORDER BY id DESC LIMIT 1
     )
     RETURNING id, prospect_id, subject, body, status`,
    [prospectId, subject, body]
  );
  return result.rows[0] || null;
}

async function setDraftStatus(prospectId, status) {
  const result = await db.query(
    `UPDATE email_drafts
     SET status = $2
     WHERE id = (
       SELECT id FROM email_drafts WHERE prospect_id = $1 ORDER BY id DESC LIMIT 1
     )
     RETURNING id, prospect_id, subject, body, status`,
    [prospectId, status]
  );
  return result.rows[0] || null;
}

module.exports = { listProspects, getProspect, updateDraft, setDraftStatus };
