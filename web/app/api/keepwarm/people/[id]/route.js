import { handler } from '../../_util';
import { updatePerson } from '../../../../../lib/keepwarm';

export const PATCH = handler(async (request, { params }) => {
  const { id } = await params;
  const r = await updatePerson(Number(id), await request.json().catch(() => ({})));
  if (!r) throw new Error('Nothing changed');
  return { ok: true };
});
