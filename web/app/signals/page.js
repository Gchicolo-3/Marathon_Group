import { Radar } from 'lucide-react';
import { listTriggerEvents } from '../../lib/queries';
import { Card, CardContent } from '../../components/ui/card';
import { SignalBadge } from '../../components/signal-badge';

export const dynamic = 'force-dynamic';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default async function SignalsPage() {
  const events = await listTriggerEvents();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Signals</h1>
        <p className="text-sm text-muted-foreground">
          Trigger events the news agent found for organizations in your pipeline — new capital
          projects, funding approvals, expansions, and leadership changes.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Radar className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No signals yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            The news agent scans for trigger events on each pipeline run (weekday mornings,
            7 AM ET). New signals will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            return (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="mr-auto text-sm font-semibold">{e.company_name || e.organization}</p>
                    <SignalBadge kind={e.event_type} />
                    <span className="font-mono text-[10.5px] text-[#5F6B85]">{formatDate(e.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{e.description}</p>
                  {e.relevance && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">Why it matters:</span>{' '}
                      {e.relevance}
                    </p>
                  )}
                  {e.source_url && (
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-[#5B8CFF] hover:underline"
                    >
                      Source →
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
