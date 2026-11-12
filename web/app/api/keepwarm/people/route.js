import { handler } from '../_util';
import { listPeople } from '../../../../lib/keepwarm';

export const dynamic = 'force-dynamic';
export const GET = handler(() => listPeople());
