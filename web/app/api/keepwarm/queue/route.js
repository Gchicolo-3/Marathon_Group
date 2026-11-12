import { handler } from '../_util';
import { listQueue, recentSent, createWeeklyTouches } from '../../../../lib/keepwarm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = handler(async () => ({ queue: await listQueue(), sent: await recentSent(15) }));

// "Write this week's notes now", so Mike does not have to wait for Sunday.
export const POST = handler(async () => createWeeklyTouches({ force: true }));
