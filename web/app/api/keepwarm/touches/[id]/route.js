import { handler } from '../../_util';
import { sendTouch, redraftTouch, skipTouch } from '../../../../../lib/keepwarm';

export const maxDuration = 60;

// { action: 'send' | 'redo' | 'skip', subject?, body?, instructions? }
export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (b.action === 'send') return sendTouch(Number(id), { subject: b.subject, body: b.body });
  if (b.action === 'redo') return redraftTouch(Number(id), b.instructions);
  if (b.action === 'skip') return skipTouch(Number(id));
  throw new Error('Unknown action');
});
