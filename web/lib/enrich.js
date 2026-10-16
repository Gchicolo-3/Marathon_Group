// Contact verification lane. Marks a contact's email as verified only when
// the provider says so. The send gate (approve route) reads email_status.
//
//   email_status: unverified | valid | catch_all | invalid | no_match | manual
//   valid and manual pass the gate. Everything else blocks Approve.
const db = require('./db');
const { getProvider } = require('./enrichment');

const MAX_ATTEMPTS = 3;          // lookups per contact before we stop paying
const RETRY_DAYS = 30;           // wait between lookups for no_match / catch_all
const PASSES_GATE = ['valid', 'manual'];

function passesGate(status) {
  return PASSES_GATE.includes(status);
}

async function logLookup(contactId, provider, outcome) {
  await db.query(
    `INSERT INTO enrichment_log (contact_id, provider, outcome) VALUES ($1, $2, $3)`,
    [contactId, provider, outcome]
  );
}

// Verifies one contact. { force: true } ignores the attempt cap (the manual
// Verify button). A no_match costs nothing on the provider side but is still
// counted as an attempt so we do not retry forever.
async function verifyContact(contactId, { force = false } = {}) {
  const provider = getProvider();
  if (!provider) {
    const err = new Error('No enrichment provider configured (set EXPLORIUM_API_KEY)');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const r = await db.query(
    `SELECT c.*, co.name AS company_name FROM contacts c
     JOIN companies co ON co.id = c.company_id WHERE c.id = $1`,
    [contactId]
  );
  const contact = r.rows[0];
  if (!contact) return null;
  if (contact.email_status === 'manual') return { contact_id: contactId, outcome: 'manual', skipped: true };
  if (!force && contact.enrichment_attempts >= MAX_ATTEMPTS) {
    return { contact_id: contactId, outcome: contact.email_status, skipped: true };
  }

  const res = await provider.lookup(contact);
  await logLookup(contactId, provider.name, res.outcome);

  const verified = res.outcome === 'valid';
  await db.query(
    `UPDATE contacts SET
       email = CASE WHEN $2::text IS NOT NULL AND $3 IN ('valid','catch_all') THEN $2 ELSE email END,
       phone = COALESCE(phone, $4),
       email_status = $3,
       email_verified_at = CASE WHEN $5 THEN now() ELSE email_verified_at END,
       enrichment_attempts = enrichment_attempts + 1,
       enrichment_last_at = now(),
       enrichment_source = $6,
       external_id = COALESCE($7, external_id)
     WHERE id = $1`,
    [contactId, res.email, res.outcome, res.phone, verified, provider.name, res.external_id]
  );
  return { contact_id: contactId, outcome: res.outcome, email: res.email };
}

// Batch: oldest-unverified first, highest-scored deals first.
async function runEnrichmentBatch(limit = 10) {
  const rows = (
    await db.query(
      `SELECT c.id FROM contacts c
       LEFT JOIN deals d ON d.contact_id = c.id
       WHERE c.email_status IN ('unverified','no_match','catch_all')
         AND c.enrichment_attempts < $2
         AND (c.enrichment_last_at IS NULL OR c.enrichment_last_at < now() - ($3 || ' days')::interval)
         AND COALESCE(d.stage::text, 'new') NOT IN ('lost','won')
       GROUP BY c.id
       ORDER BY max(d.score) DESC NULLS LAST, c.id
       LIMIT $1`,
      [limit, MAX_ATTEMPTS, String(RETRY_DAYS)]
    )
  ).rows;

  const results = [];
  for (const row of rows) {
    try {
      results.push(await verifyContact(row.id));
    } catch (err) {
      if (err.code === 'NOT_CONFIGURED') throw err;
      console.error(`Enrichment failed for contact ${row.id}:`, err.message);
      results.push({ contact_id: row.id, outcome: 'error', error: err.message });
    }
  }
  return {
    success: true,
    attempted: results.length,
    verified: results.filter((x) => x.outcome === 'valid').length,
    no_match: results.filter((x) => x.outcome === 'no_match').length,
  };
}

// Manual override: George or Mike confirms an email by hand.
async function markManuallyVerified(contactId) {
  const r = await db.query(
    `UPDATE contacts SET email_status = 'manual', email_verified_at = now()
     WHERE id = $1 AND email IS NOT NULL AND email <> '' RETURNING *`,
    [contactId]
  );
  return r.rows[0] || null;
}

// Credit meter for the dashboard.
async function getUsage() {
  try {
    const r = await db.query(
      `SELECT
         (SELECT count(*) FROM enrichment_log WHERE created_at >= date_trunc('month', now()))::int AS lookups_month,
         (SELECT count(*) FROM enrichment_log WHERE outcome = 'valid' AND created_at >= date_trunc('month', now()))::int AS verified_month,
         (SELECT count(*) FROM contacts WHERE email_status IN ('valid','manual'))::int AS verified_total,
         (SELECT count(*) FROM contacts)::int AS contacts_total`
    );
    return r.rows[0];
  } catch (err) {
    console.error('getUsage:', err.message);
    return { lookups_month: 0, verified_month: 0, verified_total: 0, contacts_total: 0 };
  }
}

module.exports = {
  verifyContact, runEnrichmentBatch, markManuallyVerified, getUsage, passesGate,
  MAX_ATTEMPTS, PASSES_GATE,
};
