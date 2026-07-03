import Link from 'next/link';
import { listDeals } from '../lib/queries';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const deals = await listDeals();

  return (
    <>
      <h1>Pipeline</h1>
      <p className="subtitle">
        {deals.length} deal{deals.length === 1 ? '' : 's'}, sorted by score
      </p>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Company</th>
              <th>Title</th>
              <th>Score</th>
              <th>Stage</th>
              <th>Draft</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} className="rowlink">
                <td>
                  <Link href={`/deal/${d.id}`} className="name-link">
                    {d.contact_name}
                  </Link>
                </td>
                <td>{d.company_name}</td>
                <td className="muted">{d.contact_title}</td>
                <td className="score">{d.score ?? '—'}</td>
                <td><span className="badge">{d.stage}</span></td>
                <td>
                  <span className={`badge ${d.draft_status || ''}`}>{d.draft_status || 'no draft'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
