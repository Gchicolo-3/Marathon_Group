import { listAgentRuns } from '../../lib/queries';
import { Card, CardContent } from '../../components/ui/card';
import { RunPipelineButton } from '../../components/run-pipeline-button';
import { cn } from '../../lib/utils';

export const dynamic = 'force-dynamic';

const RUN_TYPE_LABELS = {
  lead_pull: 'Prospector',
  qualification: 'Qualifier',
  draft_generation: 'Copywriter',
};

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default async function RunsPage() {
  const runs = await listAgentRuns();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pipeline runs</h1>
          <p className="text-sm text-muted-foreground">
            Runs automatically weekday mornings (7 AM ET) — drafts emails for qualified deals
            without one. The button triggers an extra run manually.
          </p>
        </div>
        <RunPipelineButton />
      </div>

      <Card>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              No pipeline runs recorded yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 font-semibold">Agent</th>
                  <th className="px-4 py-2.5 font-semibold">Prospects</th>
                  <th className="px-4 py-2.5 font-semibold">Drafts</th>
                  <th className="px-4 py-2.5 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      {RUN_TYPE_LABELS[r.run_type] || r.run_type}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{r.prospects_found ?? 0}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.drafts_created ?? 0}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                          r.errors
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        )}
                        title={r.errors || undefined}
                      >
                        {r.errors ? 'error' : 'ok'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
