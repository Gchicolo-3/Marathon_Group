// Vibe Prospecting (Explorium AgentSource) adapter.
//   1. POST /v1/prospects/match                       -> prospect_id
//   2. POST /v1/prospects/contacts_information/enrich -> email + status + phone
// Fails closed: a contact is only reported verified when the provider
// returns an explicit email status of "valid". Anything we cannot read is
// "unverified", never "valid".
const BASE = process.env.EXPLORIUM_BASE_URL || 'https://api.explorium.ai/v1';

function apiKey() {
  const key = process.env.EXPLORIUM_API_KEY;
  if (!key) throw new Error('EXPLORIUM_API_KEY is not set');
  return key;
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { api_key: apiKey(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Explorium ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function matchProspect({ name, company, linkedin_url, email }) {
  const item = {};
  if (linkedin_url) item.linkedin = linkedin_url;
  if (email) item.email = email;
  if (name && company) {
    item.full_name = name;
    item.company_name = company;
  }
  if (Object.keys(item).length === 0) return null;
  const data = await post('/prospects/match', { prospects_to_match: [item] });
  return data?.matched_prospects?.[0]?.prospect_id || null;
}

// Pulls the first present value out of several possible field names, since
// the sync and async enrichment endpoints name fields slightly differently.
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function parseContactInfo(raw) {
  const data = raw?.data?.[0]?.data || raw?.data || raw || {};
  const emails = Array.isArray(data.emails) ? data.emails : [];

  const email =
    pick(data, ['professional_email', 'professions_email', 'email']) ||
    emails.find((e) => e && (e.address || e.email))?.address ||
    emails.find((e) => e && e.email)?.email ||
    null;

  const statusRaw =
    pick(data, ['professional_email_status', 'email_status']) ||
    emails.find((e) => e && e.status)?.status ||
    null;
  const status = typeof statusRaw === 'string' ? statusRaw.toLowerCase() : null;

  let phone = pick(data, ['mobile_phone']);
  if (!phone && Array.isArray(data.phone_numbers) && data.phone_numbers.length) {
    const p = data.phone_numbers[0];
    phone = typeof p === 'string' ? p : p?.phone_number || p?.number || null;
  } else if (!phone && typeof data.phone_numbers === 'string') {
    phone = data.phone_numbers.split(/[;,]/)[0].trim() || null;
  }

  return { email, status, phone };
}

// Look up one contact. Returns
//   { outcome: 'valid'|'catch_all'|'invalid'|'unverified'|'no_match', email, phone, external_id, raw? }
async function lookup(contact) {
  const prospectId = contact.external_id || (await matchProspect({
    name: contact.name,
    company: contact.company_name,
    linkedin_url: contact.linkedin_url,
    email: contact.email,
  }));
  if (!prospectId) return { outcome: 'no_match', email: null, phone: null, external_id: null };

  const raw = await post('/prospects/contacts_information/enrich', { prospect_id: prospectId });
  const { email, status, phone } = parseContactInfo(raw);

  let outcome = 'unverified';
  if (!email) outcome = 'no_match';
  else if (status === 'valid') outcome = 'valid';
  else if (status === 'catch_all') outcome = 'catch_all';
  else if (status === 'invalid') outcome = 'invalid';

  return { outcome, email, phone, external_id: prospectId };
}

module.exports = { lookup, matchProspect, parseContactInfo, post, name: 'vibe' };
