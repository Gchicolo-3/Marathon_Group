import { handler } from '../_util';
import { getSettings, saveSettings } from '../../../../lib/keepwarm';

export const dynamic = 'force-dynamic';
export const GET = handler(() => getSettings());
export const POST = handler(async (request) => saveSettings(await request.json().catch(() => ({}))));
