// Pure spreadsheet helpers, no I/O. Shared by the browser importer and the
// server (lib/keepwarm.js), unit tested in scripts/test-keepwarm.js.

// Header text -> our field. First match wins, so order matters.
const HEADER_RULES = [
  ['email', /^(e-?mail|email address|e-?mail address|work email|personal email)$/],
  ['first', /^(first|first name|firstname|given name)$/],
  ['last', /^(last|last name|lastname|surname|family name)$/],
  ['name', /^(name|full name|contact|contact name|person)$/],
  ['company', /^(company|company name|organization|organisation|org|firm|employer|account)$/],
  ['title', /^(title|job title|position|role)$/],
  ['phone', /^(phone|phone number|mobile|cell|cell phone|telephone|tel|direct)$/],
  ['note', /^(notes?|comments?|relationship|how we met|context|remarks)$/],
  ['cadence', /^(cadence|frequency|touch every|every \(days\)|days)$/],
];

// Returns { field: columnIndex } for a header row.
function mapHeaders(headers) {
  const map = {};
  (headers || []).forEach((h, i) => {
    const key = String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) return;
    for (const [field, re] of HEADER_RULES) {
      if (re.test(key) && map[field] === undefined) {
        map[field] = i;
        break;
      }
    }
    // Loose fallbacks for headers like "Email (work)" or "Company / Firm".
    if (map.email === undefined && key.includes('mail')) map.email = i;
    if (map.company === undefined && /(company|firm|organi[sz]ation)/.test(key)) map.company = i;
  });
  return map;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// One spreadsheet row (array) -> clean contact object, or null if empty.
function normalizeRow(cells, map, tab) {
  const get = (f) => (map[f] === undefined ? '' : String(cells[map[f]] ?? '').trim());
  let name = get('name');
  if (!name) name = [get('first'), get('last')].filter(Boolean).join(' ');
  let email = get('email').toLowerCase().replace(/^mailto:/, '');
  if (email && !EMAIL_RE.test(email)) email = '';
  if (!name && email) name = email.split('@')[0];
  if (!name) return null;
  const cadence = parseInt(get('cadence'), 10);
  return {
    name: name.slice(0, 200),
    email,
    company: get('company').slice(0, 200),
    title: get('title').slice(0, 200),
    phone: get('phone').slice(0, 60),
    note: get('note').slice(0, 1000),
    cadence_days: Number.isFinite(cadence) && cadence >= 7 ? Math.min(cadence, 730) : null,
    tab: tab ? String(tab).slice(0, 100) : null,
  };
}

// Spread first touches across the cadence so a 300 person import does not
// all come due in week one. Index i lands in week (i mod weeks).
function spreadOffsetDays(i, cadenceDays) {
  const weeks = Math.max(1, Math.floor(cadenceDays / 7));
  return (i % weeks) * 7;
}

// Finds the header row in the first few rows of a sheet: the first row that
// maps a name (or first name) or an email column. Returns -1 when none.
function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const m = mapHeaders(rows[i]);
    if (m.email !== undefined || m.name !== undefined || m.first !== undefined) return i;
  }
  return -1;
}

module.exports = { HEADER_RULES, mapHeaders, normalizeRow, spreadOffsetDays, findHeaderRow, EMAIL_RE };
