'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SignalBadge } from './signal-badge';
import { timeAgo, runTimestamp } from '../lib/format';
import { cn } from '../lib/utils';

const AGENT_LABELS = {
  lead_pull: 'Prospector',
  qualification: 'Qualifier',
  draft_generation: 'Draft Writer',
  news_scan: 'Signal Scanner',
  daily_digest: 'Daily Digest',
  morning_brief: 'Morning Brief',
};

function describeRun(r) {
  const parts = [];
  if (r.prospects_found > 0) {
    parts.push(
      r.run_type === 'lead_pull'
        ? `pulled ${r.prospects_found} new prospect${r.prospects_found === 1 ? '' : 's'}`
        : r.run_type === 'news_scan'
          ? `surfaced ${r.prospects_found} new signal${r.prospects_found === 1 ? '' : 's'}`
          : `scored ${r.prospects_found} prospect${r.prospects_found === 1 ? '' : 's'}`
    );
  }
  if (r.drafts_created > 0) {
    parts.push(`drafted ${r.drafts_created} outreach email${r.drafts_created === 1 ? '' : 's'}`);
  }
  if (r.run_type === 'morning_brief' && parts.length === 0) parts.push('wrote the daily brief');
  if (r.run_type === 'daily_digest' && parts.length === 0) parts.push('generated the daily summary');
  if (r.errors) parts.push(r.errors);
  return parts.join('; ') || 'completed with nothing due';
}

function runStatus(r) {
  if (!r.errors) return { label: 'OK', className: 'text-[#4ADE80]', dot: 'bg-[#4ADE80]' };
  const didWork = (r.prospects_found ?? 0) > 0 || (r.drafts_created ?? 0) > 0;
  return didWork
    ? { label: 'PARTIAL', className: 'text-[#E8C25B]', dot: 'bg-[#E8C25B]' }
    : { label: 'ERROR', className: 'text-red-400', dot: 'bg-red-400' };
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

// "Wed · via source-hostname" for a trigger event.
function signalWhen(s) {
  const day = new Date(s.created_at).toLocaleDateString('en-US', {
    weekday: 'short', timeZone: 'America/Chicago',
  });
  if (!s.source_url) return day;
  try {
    return `${day} · via ${new URL(s.source_url).hostname.replace(/^www\./, '')}`;
  } catch {
    return day;
  }
}

function StatCard({ label, value, delta, deltaClass }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card px-[22px] py-5">
      <span className="text-xs font-medium tracking-[0.02em] text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-3xl font-medium tracking-[-0.02em] text-[#F2F5FB]">
          {value}
        </span>
        {delta && <span className={cn('font-mono text-[11.5px]', deltaClass)}>{delta}</span>}
      </div>
    </div>
  );
}

export function Dashboard({ initialDrafts, signals, runs, stats }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [error, setError] = useState('');

  const pendingCount = drafts.filter((d) => !d.approved).length;

  async function approve(id) {
    setError('');
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, approved: true } : d)));
    const res = await fetch(`/api/deals/${id}/approve`, { method: 'POST' });
    if (!res.ok) {
      setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, approved: false } : d)));
      setError('Failed to approve draft — change was reverted');
    }
  }

  const statCards = [
    {
      label: 'Total Prospects',
      value: stats.total_prospects,
      delta: 'in system',
      deltaClass: 'text-muted-foreground',
    },
    {
      label: 'Pending Approvals',
      value: pendingCount,
      delta: pendingCount > 0 ? 'action needed' : 'all clear',
      deltaClass: pendingCount > 0 ? 'text-[#E8C25B]' : 'text-[#4ADE80]',
    },
    {
      label: 'Active Sequences',
      value: stats.active_sequences,
      delta: 'in flight',
      deltaClass: 'text-muted-foreground',
    },
    {
      label: 'Signals This Week',
      value: stats.signals_week,
      delta: 'last 7 days',
      deltaClass: stats.signals_week > 0 ? 'text-[#4ADE80]' : 'text-muted-foreground',
    },
  ];

  const shown = drafts.slice(0, 6);

  return (
    <>
      {/* Stats row */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </section>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Two columns */}
      <section className="grid items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* Pending Email Drafts */}
        <div className="flex flex-col gap-3.5">
          <div className="flex items-baseline gap-2.5">
            <h2 className="m-0 text-[15px] font-semibold tracking-[0.01em]">Pending Email Drafts</h2>
            <span className="font-mono text-[11px] text-[#5F6B85]">
              {pendingCount} awaiting review
            </span>
            {drafts.length > shown.length && (
              <Link href="/queue" className="ml-auto text-xs text-[#5B8CFF] hover:text-[#82A8FF]">
                open queue →
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {shown.length === 0 ? (
              <div className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
                Nothing awaiting review — the queue is clear.
              </div>
            ) : (
              shown.map((d) => (
                <div
                  key={d.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border bg-card px-5 py-[18px] transition-opacity',
                    d.approved && 'border-[#4ADE80]/25 opacity-75'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-[#1A2338] text-xs font-semibold text-[#9DB4E8]">
                      {initials(d.name)}
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13.5px] font-semibold text-foreground">{d.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[d.title, d.company].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <span className="ml-auto flex-none font-mono text-[10.5px] text-[#5F6B85]">
                      {timeAgo(d.generatedAt)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-[9px] text-[13px] text-[#B8C4DC]">
                    <span className="mr-2 font-mono text-[10.5px] text-[#5F6B85]">SUBJ</span>
                    {d.subject}
                  </div>
                  {d.approved ? (
                    <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#4ADE80]">
                      <span className="font-mono">✓</span> Approved — queued to send
                    </div>
                  ) : (
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => approve(d.id)}
                        className="rounded-[7px] bg-[#2E63E8] px-[18px] py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#3B70F5]"
                      >
                        Approve
                      </button>
                      <Link
                        href={`/deal/${d.id}`}
                        className="rounded-[7px] border border-white/[0.14] px-[18px] py-2 text-[12.5px] font-medium text-[#B8C4DC] transition-colors hover:border-white/30 hover:text-foreground"
                      >
                        Edit
                      </Link>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Signals */}
        <div className="flex flex-col gap-3.5">
          <div className="flex items-baseline gap-2.5">
            <h2 className="m-0 text-[15px] font-semibold tracking-[0.01em]">Recent Signals</h2>
            <span className="font-mono text-[11px] text-[#5F6B85]">last 7 days</span>
            <Link href="/signals" className="ml-auto text-xs text-[#5B8CFF] hover:text-[#82A8FF]">
              all signals →
            </Link>
          </div>
          <div className="flex flex-col rounded-xl border bg-card">
            {signals.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No signals yet — the news agent logs them here on each pipeline run.
              </div>
            ) : (
              signals.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    'flex flex-col gap-[7px] px-5 py-4 transition-colors hover:bg-white/[0.02]',
                    i !== signals.length - 1 && 'border-b border-white/5'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
                      {s.company_name || s.organization}
                    </span>
                    <SignalBadge kind={s.event_type} className="ml-auto" />
                  </div>
                  <p className="m-0 text-[12.5px] leading-normal text-[#8C99B5]">{s.description}</p>
                  <span className="font-mono text-[10.5px] text-[#5F6B85]">{signalWhen(s)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Pipeline activity feed */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-[15px] font-semibold tracking-[0.01em]">Pipeline Activity</h2>
          <span className="font-mono text-[11px] text-[#5F6B85]">recent agent runs</span>
          <Link href="/activity" className="ml-auto text-xs text-[#5B8CFF] hover:text-[#82A8FF]">
            full activity →
          </Link>
        </div>
        <div className="rounded-xl border bg-card py-2">
          {runs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No agent runs recorded yet.
            </div>
          ) : (
            runs.map((r) => {
              const status = runStatus(r);
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[110px_12px_1fr_auto] items-center gap-4 px-6 py-[13px] transition-colors hover:bg-white/[0.02] sm:grid-cols-[150px_12px_1fr_auto]"
                >
                  <span className="font-mono text-[11px] text-[#5F6B85]">
                    {runTimestamp(r.created_at)}
                  </span>
                  <span className={cn('inline-block h-[7px] w-[7px] rounded-full', status.dot)} />
                  <span className="min-w-0 truncate text-[13px] text-[#B8C4DC]">
                    <strong className="font-semibold text-foreground">
                      {AGENT_LABELS[r.run_type] || r.run_type}
                    </strong>{' '}
                    — {describeRun(r)}
                  </span>
                  <span className={cn('font-mono text-[10.5px] tracking-[0.06em]', status.className)}>
                    {status.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
