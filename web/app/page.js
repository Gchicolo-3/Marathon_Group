import Link from 'next/link';
import { listDeals } from '../lib/queries';
import { Card } from '../components/ui/card';
import { STAGE_ORDER, STAGE_META, DraftStatusBadge } from '../components/stage-badge';
import { cn } from '../lib/utils';

export const dynamic = 'force-dynamic';

function ScorePill({ score }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    score >= 9 ? 'bg-emerald-100 text-emerald-800'
    : score >= 6 ? 'bg-blue-100 text-blue-800'
    : 'bg-slate-100 text-slate-600';
  return (
    <span className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums', tone)}>
      {score}
    </span>
  );
}

function DealCard({ deal }) {
  return (
    <Link href={`/deal/${deal.id}`} className="block">
      <Card className="p-3.5 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{deal.company_name}</p>
            <p className="truncate text-sm text-muted-foreground">{deal.contact_name}</p>
            {deal.contact_title && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{deal.contact_title}</p>
            )}
          </div>
          <ScorePill score={deal.score} />
        </div>
        <div className="mt-3">
          <DraftStatusBadge status={deal.draft_status} />
        </div>
      </Card>
    </Link>
  );
}

export default async function PipelineBoard() {
  const deals = await listDeals();
  const byStage = Object.fromEntries(STAGE_ORDER.map((s) => [s, []]));
  for (const d of deals) (byStage[d.stage] || byStage.new).push(d);

  return (
    <>
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {deals.length} deal{deals.length === 1 ? '' : 's'} across {STAGE_ORDER.length} stages
          </p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGE_ORDER.map((stage) => {
          const meta = STAGE_META[stage];
          const items = byStage[stage];
          return (
            <div key={stage} className="flex w-[260px] shrink-0 flex-col">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                <h2 className="text-sm font-semibold">{meta.label}</h2>
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {items.length}
                </span>
              </div>
              <div className="flex min-h-[120px] flex-col gap-2.5 rounded-lg bg-slate-100/70 p-2.5">
                {items.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground/70">No deals</p>
                ) : (
                  items.map((deal) => <DealCard key={deal.id} deal={deal} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
