// Unit tests for the keep warm pure helpers. No network, no database.
//   npm run test:keepwarm
const assert = require('assert');
const { mapHeaders, normalizeRow, spreadOffsetDays, findHeaderRow } = require('../lib/keepwarm-parse');

const map = mapHeaders(['First Name', 'Last Name', 'E-mail', 'Company / Firm', 'Notes', 'Cell']);
assert.deepStrictEqual(map, { first: 0, last: 1, email: 2, company: 3, note: 4, phone: 5 });
assert.strictEqual(findHeaderRow([['My contacts'], ['Name', 'Email']]), 1);
assert.strictEqual(findHeaderRow([['a', 'b']]), -1);

const row = normalizeRow(['Jane', 'Doe', ' MAILTO:Jane@Example.com ', 'Northwell', 'met at JLL', '555'], map, 'Health');
assert.deepStrictEqual(row, {
  name: 'Jane Doe', email: 'jane@example.com', company: 'Northwell', title: '', phone: '555',
  note: 'met at JLL', cadence_days: null, tab: 'Health',
});
assert.strictEqual(normalizeRow(['', '', '', '', '', ''], map), null);
assert.strictEqual(normalizeRow(['Bob', '', 'nope', '', '', ''], map).email, '');
assert.strictEqual(normalizeRow(['', '', 'sam@x.com', '', '', ''], map).name, 'sam');

assert.strictEqual(spreadOffsetDays(0, 90), 0);
assert.strictEqual(spreadOffsetDays(3, 90), 21);
assert.strictEqual(spreadOffsetDays(12, 90), 0);
assert.strictEqual(spreadOffsetDays(5, 7), 0);

console.log('keep warm parse tests passed');
