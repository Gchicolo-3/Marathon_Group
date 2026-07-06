import { listDeals, listCompanies, listContacts } from '../lib/queries';
import { Board } from '../components/board';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const [deals, companies, contacts] = await Promise.all([
    listDeals(),
    listCompanies(),
    listContacts(),
  ]);

  return <Board initialDeals={deals} companies={companies} contacts={contacts} />;
}
