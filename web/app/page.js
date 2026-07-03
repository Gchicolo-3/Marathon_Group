import Link from 'next/link';
import { listProspects } from '../lib/queries';

export const dynamic = 'force-dynamic';

function StatusBadge({ status }) {
  if (!status) return <span className="badge">no draft</span>;
  return <span className={`badge ${status}`}>{status}</span>;
}

export default async function DashboardPage() {
  const prospects = await listProspects();

  return (
    <>
      <h1>Prospects</h1>
      <p className="subtitle">
        {prospects.length} prospect{prospects.length === 1 ? '' : 's'}, sorted by qualification score
      </p>
      <div className="card">
        {prospects.length === 0 ? (
          <div className="empty">No prospects in the database yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Title</th>
                <th>Score</th>
                <th>Draft subject</th>
                <th>Draft status</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id} className="rowlink">
                  <td>
                    <Link href={`/prospect/${p.id}`} className="name-link">
                      {p.first_name} {p.last_name}
                    </Link>
                  </td>
                  <td>{p.company}</td>
                  <td className="muted">{p.title}</td>
                  <td className="score">{p.qualification_score ?? '—'}</td>
                  <td className="muted">{p.draft_subject || '—'}</td>
                  <td>
                    <StatusBadge status={p.draft_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
