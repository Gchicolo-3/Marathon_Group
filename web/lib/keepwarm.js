// Keep warm engine (Phase A). Mike's own network only: people he imported
// from his Excel file. Each person has a cadence; when they come due, a two
// line note is drafted in his voice and waits in This Week until he edits,
// redoes, skips or sends it. Nothing is ever sent without his tap.
//
// Pure helpers (mapHeaders, normalizeRow, spreadOffsetDays, cleanNote) have
// no I/O and are unit tested in scripts/test-keepwarm.js.
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const DEFAULT_SETTINGS = {
  default_cadence_days: 90,
  weekly_max: 10,
  paused: false,
  voice_samples: [],
  sign_off: 'Mike',
  setup_done: false,
  digest: true,
};
const CADENCE_CHOICES = [30, 60, 90, 180, 365];
const NO_COMPANY = 'Personal network';

/* ------------------------------ settings ------------------------------ */

async function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  try {
    const r = await db.query(`SELECT key, value FROM app_settings`);
    for (const row of r.rows) if (row.key in DEFAULT_SETTINGS) out[row.key] = row.value;
  } catch (err) {
    console.error('getSettings:', err.message);
  }
  return out;
}

async function saveSettings(patch) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    let v = value;
    if (key === 'default_cadence_days') v = clampCadence(value);
    if (key === 'weekly_max') v = Math.max(1, Math.min(50, Number(value) || DEFAULT_SETTINGS.weekly_max));
    if (key === 'voice_samples') v = (Array.isArray(value) ? value : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 5);
    if (key === 'sign_off') v = String(value || '').trim().slice(0, 200) || DEFAULT_SETTINGS.sign_off;
    if (['paused', 'setup_done', 'digest'].includes(key)) v = !!value;
    await db.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(v)]
    );
  }
  return getSettings();
}

function clampCadence(n) {
  const v = Math.round(Number(n) || 0);
  if (v < 7) return DEFAULT_SETTINGS.default_cadence_days;
  return Math.min(v, 730);
}

/* ------------------------------- import ------------------------------- */

const { mapHeaders, normalizeRow, spreadOffsetDays, findHeaderRow, EMAIL_RE } = require('./keepwarm-parse');

async function upsertCompany(name) {
  const r = await db.query(
    `INSERT INTO companies (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name || NO_COMPANY]
  );
  return r.rows[0].id;
}

// rows: normalized contacts. startIndex keeps the spread going across chunks.
async function importContacts(rows, { startIndex = 0 } = {}) {
  const settings = await getSettings();
  const out = { created: 0, updated: 0, skipped: 0, no_email: 0 };
  const companyIds = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.name) { out.skipped++; continue; }
    const cadence = row.cadence_days || null;
    const offset = spreadOffsetDays(startIndex + i, cadence || settings.default_cadence_days);
    const companyName = row.company || NO_COMPANY;
    if (!companyIds.has(companyName)) companyIds.set(companyName, await upsertCompany(companyName));
    const companyId = companyIds.get(companyName);

    let existing = null;
    if (row.email) {
      existing = (await db.query(`SELECT id FROM contacts WHERE lower(email) = $1 ORDER BY keep_warm DESC, id LIMIT 1`, [row.email])).rows[0];
    } else {
      // No email: match on name within the same company so importing the
      // same file twice does not double these people.
      existing = (await db.query(
        `SELECT id FROM contacts WHERE keep_warm AND lower(name) = lower($1) AND company_id = $2 ORDER BY id LIMIT 1`,
        [row.name, companyId]
      )).rows[0];
    }

    if (existing) {
      await db.query(
        `UPDATE contacts SET
           keep_warm = true,
           name = COALESCE(NULLIF($2, ''), name),
           title = COALESCE(NULLIF($3, ''), title),
           phone = COALESCE(NULLIF($4, ''), phone),
           relationship_note = COALESCE(NULLIF($5, ''), relationship_note),
           cadence_days = COALESCE($6, cadence_days),
           list_tab = COALESCE($7, list_tab),
           next_touch_at = COALESCE(next_touch_at, now() + ($8 || ' days')::interval),
           imported_at = now()
         WHERE id = $1`,
        [existing.id, row.name, row.title, row.phone, row.note, cadence, row.tab, String(offset)]
      );
      out.updated++;
    } else {
      await db.query(
        `INSERT INTO contacts (company_id, name, title, email, phone, keep_warm, cadence_days,
                               relationship_note, list_tab, next_touch_at, imported_at)
         VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), true, $6,
                 NULLIF($7, ''), $8, now() + ($9 || ' days')::interval, now())`,
        [companyId, row.name, row.title, row.email, row.phone, cadence, row.note, row.tab, String(offset)]
      );
      out.created++;
    }
    if (!row.email) out.no_email++;
  }
  return out;
}

/* ------------------------------- people ------------------------------- */

async function listPeople() {
  const r = await db.query(
    `SELECT c.id, c.name, c.title, c.email, c.phone, c.cadence_days, c.last_touch_at, c.next_touch_at,
            c.relationship_note, c.list_tab, co.name AS company,
            (SELECT max(t.replied_at) FROM touches t WHERE t.contact_id = c.id) AS last_reply_at,
            EXISTS (SELECT 1 FROM touches t WHERE t.contact_id = c.id AND t.status = 'pending') AS has_pending
     FROM contacts c JOIN companies co ON co.id = c.company_id
     WHERE c.keep_warm
     ORDER BY c.next_touch_at ASC NULLS LAST, c.name`
  );
  return r.rows;
}

async function updatePerson(id, patch) {
  const fields = [];
  const vals = [id];
  const set = (col, v) => { vals.push(v); fields.push(`${col} = $${vals.length}`); };
  if ('email' in patch) {
    const e = String(patch.email || '').trim().toLowerCase();
    if (e && !EMAIL_RE.test(e)) throw new Error('That email address does not look right');
    set('email', e || null);
  }
  if ('relationship_note' in patch) set('relationship_note', String(patch.relationship_note || '').slice(0, 1000) || null);
  if ('cadence_days' in patch) set('cadence_days', patch.cadence_days ? clampCadence(patch.cadence_days) : null);
  if ('keep_warm' in patch) set('keep_warm', !!patch.keep_warm);
  if ('touch_now' in patch && patch.touch_now) fields.push(`next_touch_at = now()`);
  if (!fields.length) return null;
  const r = await db.query(`UPDATE contacts SET ${fields.join(', ')} WHERE id = $1 RETURNING id`, vals);
  return r.rows[0] || null;
}

/* ------------------------------ drafting ------------------------------ */

let client;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic();
  }
  return client;
}

const BANNED = [
  'i hope this email finds you well', 'hope this finds you well', 'just checking in', 'circling back',
  'touching base', 'i wanted to reach out', 'synergy', 'leverage', 'looking forward to connecting',
];

// Strips em dashes and any sign off the model added; we append our own.
function cleanNote(body, signOff) {
  let text = String(body || '')
    .replace(/—|–/g, ', ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  const lines = text.split('\n');
  while (lines.length && /^(best|thanks|cheers|regards|talk soon|mike|michael)[,!.]?\s*$/i.test(lines[lines.length - 1].trim())) lines.pop();
  text = lines.join('\n').trim();
  return `${text}\n\n${signOff || DEFAULT_SETTINGS.sign_off}`;
}

function bannedIn(text) {
  const t = String(text || '').toLowerCase();
  return BANNED.filter((p) => t.includes(p));
}

async function draftNote(contact, { instructions = '', settings } = {}) {
  const s = settings || (await getSettings());
  const samples = (s.voice_samples || []).slice(0, 5);
  const firstName = String(contact.name || '').split(/\s+/)[0] || 'there';
  const last = contact.last_touch_at ? new Date(contact.last_touch_at).toDateString() : 'not on record';

  const prompt = `You write short keep in touch notes for Mike Sullivan, Marathon Group LLC, an owner's rep and senior construction project manager. These go to people already in his network. This is relationship upkeep, not a pitch.

${samples.length
    ? `Here are emails Mike actually wrote. Match his tone, length and word choice:\n\n${samples.map((x, i) => `--- Sample ${i + 1} ---\n${x}`).join('\n\n')}`
    : 'No writing samples yet. Keep it plain, direct and warm, the way a 35 year construction veteran writes to someone he knows.'}

The person:
Name: ${contact.name}
Title: ${contact.title || 'unknown'}
Company: ${contact.company && contact.company !== NO_COMPANY ? contact.company : 'unknown'}
List or tab: ${contact.list_tab || 'none'}
Mike's note about them: ${contact.relationship_note || 'none'}
Last time Mike reached out through this app: ${last}
${instructions ? `\nMike's instructions for this note: ${instructions}\n` : ''}
Rules:
- Two or three short sentences. Open with "${firstName}," on its own line.
- Only use facts given above. Never invent shared history, projects, meetings, family or news.
- No selling, no services pitch, no calendar links. A light ask is fine: coffee, a call, how things are going.
- No em dashes. No "just checking in", "circling back", "touching base", "hope this finds you well".
- Do not add a sign off or signature.
- Subject: short and casual, lowercase is fine, no clickbait.

Return ONLY valid JSON: {"subject": "...", "body": "..."}`;

  const generate = async (p) => {
    const res = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: p }],
    });
    const text = res.content[0].text;
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  };

  let draft = await generate(prompt);
  const bad = bannedIn(`${draft.subject} ${draft.body}`);
  if (bad.length) {
    draft = await generate(`${prompt}\n\nA previous attempt used banned phrases (${bad.join(', ')}). Rewrite without them.`);
  }
  return {
    subject: String(draft.subject || `${firstName}, quick hello`).slice(0, 150),
    body: cleanNote(draft.body, s.sign_off),
  };
}

async function contactForDraft(contactId) {
  const r = await db.query(
    `SELECT c.*, co.name AS company FROM contacts c JOIN companies co ON co.id = c.company_id WHERE c.id = $1`,
    [contactId]
  );
  return r.rows[0] || null;
}

/* ------------------------------- touches ------------------------------ */

// Drafts notes for everyone due in the next 6 days, up to weekly_max minus
// whatever is already waiting. Returns { drafted, waiting, errors }.
async function createWeeklyTouches({ force = false } = {}) {
  const s = await getSettings();
  if (s.paused && !force) return { drafted: 0, waiting: 0, paused: true, errors: [] };

  const waiting = (await db.query(`SELECT count(*)::int AS n FROM touches WHERE status = 'pending'`)).rows[0].n;
  const room = Math.max(0, s.weekly_max - waiting);
  const errors = [];
  let drafted = 0;
  if (room > 0) {
    const due = (
      await db.query(
        `SELECT c.id FROM contacts c
         WHERE c.keep_warm AND c.email IS NOT NULL AND c.email <> ''
           AND (c.next_touch_at IS NULL OR c.next_touch_at <= now() + interval '6 days')
           AND NOT EXISTS (SELECT 1 FROM touches t WHERE t.contact_id = c.id AND t.status = 'pending')
         ORDER BY c.next_touch_at ASC NULLS FIRST, c.id
         LIMIT $1`,
        [room]
      )
    ).rows;
    for (const row of due) {
      try {
        const contact = await contactForDraft(row.id);
        const d = await draftNote(contact, { settings: s });
        const ins = await db.query(
          `INSERT INTO touches (contact_id, subject, body) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING RETURNING id`,
          [row.id, d.subject, d.body]
        );
        if (ins.rows.length) drafted++;
      } catch (err) {
        errors.push(`contact ${row.id}: ${err.message}`);
      }
    }
  }
  return { drafted, waiting: waiting + drafted, errors };
}

async function listQueue() {
  const r = await db.query(
    `SELECT t.id, t.subject, t.body, t.created_at, t.contact_id,
            c.name, c.title, c.email, c.relationship_note, c.list_tab, c.last_touch_at, c.cadence_days,
            co.name AS company
     FROM touches t JOIN contacts c ON c.id = t.contact_id JOIN companies co ON co.id = c.company_id
     WHERE t.status = 'pending'
     ORDER BY t.created_at, t.id`
  );
  return r.rows;
}

async function recentSent(limit = 20) {
  const r = await db.query(
    `SELECT t.id, t.subject, t.sent_at, t.replied_at, t.reply_snippet, c.name, co.name AS company
     FROM touches t JOIN contacts c ON c.id = t.contact_id JOIN companies co ON co.id = c.company_id
     WHERE t.status = 'sent' ORDER BY t.sent_at DESC LIMIT $1`,
    [limit]
  );
  return r.rows;
}

async function getTouch(id) {
  const r = await db.query(`SELECT * FROM touches WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function cadenceFor(contactId) {
  const s = await getSettings();
  const r = await db.query(`SELECT cadence_days FROM contacts WHERE id = $1`, [contactId]);
  return r.rows[0]?.cadence_days || s.default_cadence_days;
}

async function redraftTouch(id, instructions) {
  const t = await getTouch(id);
  if (!t || t.status !== 'pending') throw new Error('That note is no longer waiting');
  const contact = await contactForDraft(t.contact_id);
  const d = await draftNote(contact, { instructions: String(instructions || '').slice(0, 500) });
  await db.query(`UPDATE touches SET subject = $2, body = $3, instructions = $4 WHERE id = $1`, [id, d.subject, d.body, instructions || null]);
  return { ...t, ...d };
}

async function skipTouch(id) {
  const t = await getTouch(id);
  if (!t || t.status !== 'pending') throw new Error('That note is no longer waiting');
  const cadence = await cadenceFor(t.contact_id);
  await db.query(`UPDATE touches SET status = 'skipped', skipped_at = now() WHERE id = $1`, [id]);
  await db.query(`UPDATE contacts SET next_touch_at = now() + ($2 || ' days')::interval WHERE id = $1`, [t.contact_id, String(cadence)]);
  return { ok: true };
}

// The only send path. Called from the Send button, never from a cron.
async function sendTouch(id, { subject, body } = {}) {
  const google = require('./google');
  const t = await getTouch(id);
  if (!t || t.status !== 'pending') throw new Error('That note is no longer waiting');
  const contact = await contactForDraft(t.contact_id);
  if (!contact?.email) throw new Error(`No email address for ${contact?.name || 'this person'}. Add one on the People page.`);
  if (!(await google.isConnected())) throw new Error('Gmail is not connected. Connect it in Settings.');

  const finalSubject = String(subject ?? t.subject ?? '').trim() || 'hello';
  const finalBody = String(body ?? t.body ?? '').trim();
  if (!finalBody) throw new Error('The note is empty');

  // Claim the row first so a double tap cannot send twice.
  const claim = await db.query(`UPDATE touches SET status = 'sending' WHERE id = $1 AND status = 'pending' RETURNING id`, [id]);
  if (!claim.rows.length) throw new Error('That note is already being sent');

  try {
    const sent = await google.sendMail({ to: contact.email, toName: contact.name, subject: finalSubject, body: finalBody });
    const cadence = await cadenceFor(t.contact_id);
    await db.query(
      `UPDATE touches SET status = 'sent', sent_at = now(), subject = $2, body = $3,
              gmail_message_id = $4, gmail_thread_id = $5 WHERE id = $1`,
      [id, finalSubject, finalBody, sent.messageId, sent.threadId]
    );
    await db.query(
      `UPDATE contacts SET last_touch_at = now(), next_touch_at = now() + ($2 || ' days')::interval WHERE id = $1`,
      [t.contact_id, String(cadence)]
    );
    return { ok: true, from: sent.from, to: contact.email };
  } catch (err) {
    await db.query(`UPDATE touches SET status = 'pending' WHERE id = $1 AND status = 'sending'`, [id]).catch(() => {});
    throw err;
  }
}

// Reply reader for touches. Marks replied_at the first time the person
// answers in the same Gmail thread.
async function checkTouchReplies(limit = 40) {
  const google = require('./google');
  if (!(await google.isConnected())) return { checked: 0, replies: 0, skipped: 'gmail not connected' };
  const rows = (
    await db.query(
      `SELECT id, gmail_thread_id, sent_at FROM touches
       WHERE status = 'sent' AND replied_at IS NULL AND gmail_thread_id IS NOT NULL
         AND sent_at > now() - interval '60 days'
       ORDER BY gmail_checked_at ASC NULLS FIRST, id LIMIT $1`,
      [limit]
    )
  ).rows;
  let replies = 0;
  const errors = [];
  for (const row of rows) {
    try {
      const { thread, ownEmail } = await google.getThread(row.gmail_thread_id);
      const found = google.replyMessagesInThread(thread, { ownEmail, afterMs: new Date(row.sent_at).getTime() - 60000 });
      if (found.length) {
        await db.query(`UPDATE touches SET replied_at = now(), reply_snippet = $2 WHERE id = $1`, [row.id, found[0].text.slice(0, 300)]);
        replies++;
      }
    } catch (err) {
      errors.push(`touch ${row.id}: ${err.message}`);
    }
    await db.query(`UPDATE touches SET gmail_checked_at = now() WHERE id = $1`, [row.id]).catch(() => {});
  }
  return { checked: rows.length, replies, errors };
}

/* ------------------------------- digest ------------------------------- */

function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  try { return new URL(process.env.GOOGLE_REDIRECT_URI).origin; } catch { return ''; }
}

// Emails Mike from his own Gmail to his own Gmail: who is up this week.
async function sendWeeklyDigest() {
  const google = require('./google');
  const s = await getSettings();
  if (!s.digest || !(await google.isConnected())) return { sent: false };
  const queue = await listQueue();
  if (!queue.length) return { sent: false, reason: 'nobody up this week' };
  const { email } = await google.getStatus();
  const lines = queue.map((q) => `- ${q.name}${q.company && q.company !== NO_COMPANY ? `, ${q.company}` : ''}`);
  const body = `${queue.length} ${queue.length === 1 ? 'person is' : 'people are'} up this week. Notes are written and waiting for you.

${lines.join('\n')}

Review, tweak and send: ${appUrl()}/keep-warm

Nothing goes out until you tap Send.`;
  await google.sendMail({ to: email, toName: 'Mike', subject: `Keep warm: ${queue.length} up this week`, body });
  return { sent: true, count: queue.length };
}

/* ------------------------------- setup -------------------------------- */

async function setupStatus() {
  const google = require('./google');
  const s = await getSettings();
  const gmail = await google.getStatus().catch(() => null);
  const counts = (
    await db.query(
      `SELECT count(*)::int AS people,
              count(*) FILTER (WHERE email IS NOT NULL AND email <> '')::int AS with_email
       FROM contacts WHERE keep_warm`
    )
  ).rows[0];
  return {
    google_configured: google.isConfigured(),
    gmail: gmail?.connected ? { email: gmail.email } : null,
    people: counts.people,
    with_email: counts.with_email,
    voice_samples: (s.voice_samples || []).length,
    settings: s,
  };
}

module.exports = {
  DEFAULT_SETTINGS, CADENCE_CHOICES, NO_COMPANY,
  getSettings, saveSettings,
  mapHeaders, normalizeRow, spreadOffsetDays, cleanNote, bannedIn,
  importContacts, listPeople, updatePerson,
  draftNote, createWeeklyTouches, listQueue, recentSent, redraftTouch, skipTouch, sendTouch,
  checkTouchReplies, sendWeeklyDigest, setupStatus,
};
