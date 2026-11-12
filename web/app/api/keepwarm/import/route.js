import { handler } from '../_util';
import { importContacts } from '../../../../lib/keepwarm';

export const maxDuration = 300;

// Body: { rows: [normalized contacts], startIndex }. The browser parses the
// Excel or CSV file and sends rows in chunks of 100.
export const POST = handler(async (request) => {
  const { rows, startIndex } = await request.json().catch(() => ({}));
  if (!Array.isArray(rows)) throw new Error('No rows sent');
  if (rows.length > 200) throw new Error('Send at most 200 rows at a time');
  return importContacts(rows, { startIndex: Number(startIndex) || 0 });
});
