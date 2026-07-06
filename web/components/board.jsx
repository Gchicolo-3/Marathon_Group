'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Plus } from 'lucide-react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { STAGE_ORDER, STAGE_META, DraftStatusBadge } from './stage-badge';
import { NewDealDialog } from './new-deal-dialog';
import { cn } from '../lib/utils';

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

export function Board({ initialDeals, companies, contacts }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [query, setQuery] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [error, setError] = useState('');
  const [newDealOpen, setNewDealOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (minScore > 0 && (d.score == null || d.score < minScore)) return false;
      if (!q) return true;
      return (
        (d.company_name || '').toLowerCase().includes(q) ||
        (d.contact_name || '').toLowerCase().includes(q) ||
        (d.contact_title || '').toLowerCase().includes(q)
      );
    });
  }, [deals, query, minScore]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGE_ORDER.map((s) => [s, []]));
    for (const d of filtered) (map[d.stage] || map.new).push(d);
    return map;
  }, [filtered]);

  async function moveDeal(dealId, stage) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === stage) return;
    const prev = deal.stage;
    setError('');
    setDeals((ds) => ds.map((d) => (d.id === dealId ? { ...d, stage } : d)));
    const res = await fetch(`/api/deals/${dealId}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) {
      setDeals((ds) => ds.map((d) => (d.id === dealId ? { ...d, stage: prev } : d)));
      setError('Failed to move deal — change was reverted');
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length === deals.length
              ? `${deals.length} deal${deals.length === 1 ? '' : 's'}`
              : `${filtered.length} of ${deals.length} deals`}{' '}
            · drag cards between stages
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search company, contact…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 pl-8"
          />
        </div>
        <select
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="h-9 rounded-md border border-input bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value={0}>Any score</option>
          <option value={6}>Score ≥ 6</option>
          <option value={8}>Score ≥ 8</option>
          <option value={9}>Score ≥ 9</option>
          <option value={10}>Score 10</option>
        </select>
        <Button onClick={() => setNewDealOpen(true)}>
          <Plus /> New deal
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGE_ORDER.map((stage) => {
          const meta = STAGE_META[stage];
          const items = byStage[stage];
          return (
            <div
              key={stage}
              className="flex w-[260px] shrink-0 flex-col"
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOverStage(null);
                const id = Number(e.dataTransfer.getData('text/plain'));
                if (id) moveDeal(id, stage);
              }}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                <h2 className="text-sm font-semibold">{meta.label}</h2>
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {items.length}
                </span>
              </div>
              <div
                className={cn(
                  'flex min-h-[140px] flex-1 flex-col gap-2.5 rounded-lg p-2.5 transition-colors',
                  overStage === stage && dragId != null
                    ? 'bg-blue-50 ring-2 ring-blue-300'
                    : 'bg-slate-100/70'
                )}
              >
                {items.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground/70">
                    {overStage === stage && dragId != null ? 'Drop here' : 'No deals'}
                  </p>
                ) : (
                  items.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(deal.id));
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(deal.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      className={cn('cursor-grab active:cursor-grabbing', dragId === deal.id && 'opacity-50')}
                    >
                      <Link href={`/deal/${deal.id}`} draggable={false} className="block">
                        <Card className="p-3.5 transition-shadow hover:shadow-md">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{deal.company_name}</p>
                              <p className="truncate text-sm text-muted-foreground">{deal.contact_name}</p>
                              {deal.contact_title && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                                  {deal.contact_title}
                                </p>
                              )}
                            </div>
                            <ScorePill score={deal.score} />
                          </div>
                          <div className="mt-3">
                            <DraftStatusBadge status={deal.draft_status} />
                          </div>
                        </Card>
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <NewDealDialog
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        companies={companies}
        contacts={contacts}
        onCreated={async () => {
          setNewDealOpen(false);
          const res = await fetch('/api/deals');
          if (res.ok) setDeals(await res.json());
          router.refresh();
        }}
      />
    </>
  );
}
