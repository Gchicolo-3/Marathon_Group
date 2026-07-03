// Migration 001: restructure the flat prospects/email_drafts model into a
// proper CRM data model:
//
//   companies(id, name, industry, notes, created_at)
//   contacts(id, company_id FK, name, title, email, phone, linkedin_url, created_at)
//   deals(id, contact_id FK, company_id FK, score, stage, source, created_at, updated_at)
//   email_drafts(id, deal_id FK, subject, body, status, ai_generated_at, edited_at)
//   activities(id, deal_id FK, type, content, created_at)
//
// The legacy prospects table is left completely untouched. The legacy
// email_drafts table (keyed by prospect_id) is renamed to
// legacy_email_drafts and its rows are copied into the new deal-keyed
// email_drafts table. Idempotent: re-running against a migrated database
// is a no-op.
//
//   npm run migrate   (reads DATABASE_URL from .env)
require('dotenv').config();
const db = require('../lib/db');

const STAGE_FROM_STATUS = {
  new: 'new',
  qualified: 'qualified',
  emailed: 'contacted',
  replied: 'replied',
  disqualified: 'lost',
};

async function tableExists(name) {
  const r = await db.query(`SELECT to_regclass($1) AS t`, [`public.${name}`]);
  return r.rows[0].t !== null;
}

async function columnExists(table, column) {
  const r = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return r.rows.length > 0;
}

async function createSchema() {
  await db.query(`DO $$ BEGIN
    CREATE TYPE deal_stage AS ENUM ('new','qualified','contacted','replied','meeting_set','won','lost');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

  await db.query(`DO $$ BEGIN
    CREATE TYPE activity_kind AS ENUM ('note','stage_change','email_sent','ai_regenerate');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

  await db.query(`CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    industry TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS contacts_company_id_idx ON contacts(company_id)`);

  await db.query(`CREATE TABLE IF NOT EXISTS deals (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    score INTEGER,
    stage deal_stage NOT NULL DEFAULT 'new',
    source TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS deals_contact_id_idx ON deals(contact_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS deals_company_id_idx ON deals(company_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals(stage)`);

  // Rename the legacy prospect-keyed email_drafts out of the way, then
  // create the new deal-keyed table under the canonical name.
  if (await tableExists('email_drafts')) {
    if (await columnExists('email_drafts', 'prospect_id')) {
      await db.query(`ALTER TABLE email_drafts RENAME TO legacy_email_drafts`);
      console.log('Renamed legacy email_drafts -> legacy_email_drafts');
    }
  }
  await db.query(`CREATE TABLE IF NOT EXISTS email_drafts (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    subject TEXT,
    body TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    ai_generated_at TIMESTAMP,
    edited_at TIMESTAMP
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS email_drafts_deal_id_idx ON email_drafts(deal_id)`);

  await db.query(`CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    type activity_kind NOT NULL,
    content TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS activities_deal_id_idx ON activities(deal_id)`);
}

async function migrateData() {
  const dealCount = await db.query(`SELECT count(*)::int AS n FROM deals`);
  if (dealCount.rows[0].n > 0) {
    console.log(`deals already has ${dealCount.rows[0].n} rows — skipping data migration`);
    return;
  }

  const prospects = (await db.query(`SELECT * FROM prospects ORDER BY id`)).rows;
  const legacyDrafts = (await tableExists('legacy_email_drafts'))
    ? (await db.query(`SELECT * FROM legacy_email_drafts ORDER BY id`)).rows
    : [];
  console.log(`Migrating ${prospects.length} prospects, ${legacyDrafts.length} legacy drafts`);

  const companyIds = new Map(); // company name -> id

  for (const p of prospects) {
    const companyName = (p.company || 'Unknown Company').trim();

    let companyId = companyIds.get(companyName);
    if (!companyId) {
      const c = await db.query(
        `INSERT INTO companies (name, industry, created_at)
         VALUES ($1, $2, COALESCE($3, now()))
         ON CONFLICT (name) DO UPDATE SET industry = COALESCE(companies.industry, EXCLUDED.industry)
         RETURNING id`,
        [companyName, p.industry, p.created_at]
      );
      companyId = c.rows[0].id;
      companyIds.set(companyName, companyId);
    }

    const contact = await db.query(
      `INSERT INTO contacts (company_id, name, title, email, linkedin_url, created_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()))
       RETURNING id`,
      [
        companyId,
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'Unknown',
        p.title,
        p.email,
        p.linkedin_url,
        p.created_at,
      ]
    );
    const contactId = contact.rows[0].id;

    const stage = STAGE_FROM_STATUS[p.status] || 'new';
    const deal = await db.query(
      `INSERT INTO deals (contact_id, company_id, score, stage, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), COALESCE($6, now()))
       RETURNING id`,
      [contactId, companyId, p.qualification_score, stage, 'ai_prospector', p.created_at]
    );
    const dealId = deal.rows[0].id;

    for (const d of legacyDrafts.filter((d) => d.prospect_id === p.id)) {
      await db.query(
        `INSERT INTO email_drafts (deal_id, subject, body, status, ai_generated_at)
         VALUES ($1, $2, $3, COALESCE($4, 'pending'), $5)`,
        [dealId, d.subject, d.body, d.status, d.created_at]
      );
    }

    console.log(
      `  prospect ${p.id} -> company ${companyId}, contact ${contactId}, deal ${dealId} (${stage})`
    );
  }
}

async function verify() {
  const counts = await db.query(
    `SELECT (SELECT count(*) FROM prospects)::int AS legacy_prospects,
            (SELECT count(*) FROM companies)::int AS companies,
            (SELECT count(*) FROM contacts)::int AS contacts,
            (SELECT count(*) FROM deals)::int AS deals,
            (SELECT count(*) FROM email_drafts)::int AS email_drafts,
            (SELECT count(*) FROM legacy_email_drafts)::int AS legacy_email_drafts,
            (SELECT count(*) FROM activities)::int AS activities`
  );
  console.log('\n=== Post-migration counts ===');
  console.log(counts.rows[0]);

  const orphans = await db.query(
    `SELECT (SELECT count(*) FROM deals d LEFT JOIN contacts c ON c.id = d.contact_id WHERE c.id IS NULL)::int AS deals_without_contact,
            (SELECT count(*) FROM deals d LEFT JOIN companies co ON co.id = d.company_id WHERE co.id IS NULL)::int AS deals_without_company,
            (SELECT count(*) FROM email_drafts e LEFT JOIN deals d ON d.id = e.deal_id WHERE d.id IS NULL)::int AS drafts_without_deal`
  );
  console.log('=== Orphan check (all should be 0) ===');
  console.log(orphans.rows[0]);

  const sample = await db.query(
    `SELECT d.id, co.name AS company, c.name AS contact, d.score, d.stage, e.subject, e.status
     FROM deals d
     JOIN contacts c ON c.id = d.contact_id
     JOIN companies co ON co.id = d.company_id
     LEFT JOIN email_drafts e ON e.deal_id = d.id
     ORDER BY d.score DESC NULLS LAST LIMIT 5`
  );
  console.log('=== Sample deals ===');
  console.table(sample.rows);
}

async function main() {
  await createSchema();
  await migrateData();
  await verify();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
