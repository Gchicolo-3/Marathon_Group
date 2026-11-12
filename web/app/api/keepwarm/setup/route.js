import { handler } from '../_util';
import { setupStatus } from '../../../../lib/keepwarm';

export const dynamic = 'force-dynamic';
export const GET = handler(() => setupStatus());
