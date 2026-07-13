import Link from 'next/link';
import {
  StickyNote, ArrowRightLeft, Mail, Sparkles, Bot, Search,
  ClipboardCheck, FileText, Newspaper, AlertTriangle, Activity as ActivityIcon,
} from 'lucide-react';
import { listActivityFeed } from '../../lib/queries';
import { Card, CardContent } from '../../components/ui/card';
import { SignalBadge } from '../../components/signal-badge';
import { cn } from '../../lib/utils';

export const dynamic = 'force-dynamic';

// Every feed entry reads as a plain-English sentence about what happened —
// no agent jargon. Signals get their own entries with a source link;
// system runs only surface when they produced something (or failed).
function describeEntry(entry) {
  const n = entry.prospects_found ?? 0;
  const d = entry.drafts_created ?? 0;

  if (entry.kind === 'signal') {
    return {
      icon: Newspaper,
      title: `New signal — ${entry.company_name}`,
      body: entry.notes,
      href: null,
      sourceUrl: entry.source_url,
      signalKind: entry.type,
    };
  }

  if (entry.kind === 'agent_run') {
    if (entry.errors) {
      return {
        icon: AlertTriangle,
        title: 'Needs attention',
        body: entry.errors,
        alert: true,
      };
    }
    switch (entry.type) {
      case 'lead_pull':
        return {
          icon: Search,
          title: `${n} new prospect${n === 1 ? '' : 's'} added to the pipeline`,
          body: 'Found by the prospector during its scheduled sweep.',
        };
      case 'qualification':
        return {
          icon: ClipboardCheck,
          title: `${n} prospect${n === 1 ? '' : 's'} scored`,
          body: 'Rated against your ideal customer profile — high scores surface first on the board.',
        };
      case 'draft_generation':
        return {
          icon: FileText,
          title: `${d} email${d === 1 ? '' : 's'} drafted`,
          body: 'Waiting in your approval queue — nothing sends without your sign-off.',
          href: '/queue',
          hrefLabel: 'Review queue →',
        };
      case 'daily_digest':
        return { icon: Mail, title: 'Daily summary sent', body: 'Your end-of-day digest went out by email.' };
      default:
        return { icon: Bot, title: 'System task completed', body: null };
    }
  }

  // Per-deal activities — the content column is already human-written.
  const meta = {
    note: { icon: StickyNote, title: 'Note added' },
    stage_change: { icon: ArrowRightLeft, title: 'Deal moved' },
    email_sent: { icon: Mail, title: 'Email sent' },
    ai_regenerate: { icon: Sparkles, title: 'Draft written' },
  }[entry.type] || { icon: Bot, title: 'Update' };

  return { ...meta, body: entry.notes };
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default async function ActivityPage() {
  const feed = await listActivityFeed();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Everything happening in your pipeline, newest first — new signals, drafts ready for
          review, emails sent, and deals moving.
        </p>
      </div>

      {feed.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <ActivityIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No activity yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            New signals, drafts, sends, and deal updates will show up here as the pipeline works.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ol className="divide-y divide-white/5">
              {feed.map((entry) => {
                const e = describeEntry(entry);
                const Icon = e.icon;
                return (
                  <li key={`${entry.kind}-${entry.id}`} className="flex gap-3 px-4 py-3.5">
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        e.alert
                          ? 'bg-[#E8C25B]/15'
                          : entry.kind === 'signal'
                            ? 'bg-[#5B8CFF]/15'
                            : 'bg-secondary'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-3.5 w-3.5',
                          e.alert
                            ? 'text-[#E8C25B]'
                            : entry.kind === 'signal'
                              ? 'text-[#7FA0F0]'
                              : 'text-muted-foreground'
                        )}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium">{e.title}</span>
                        {e.signalKind && <SignalBadge kind={e.signalKind} />}
                        {entry.contact_name && (
                          <Link
                            href={`/deal/${entry.deal_id}`}
                            className="truncate text-sm text-[#5B8CFF] hover:underline"
                          >
                            {entry.contact_name}
                            {entry.company_name ? ` · ${entry.company_name}` : ''}
                          </Link>
                        )}
                        <span className="ml-auto whitespace-nowrap font-mono text-[10.5px] text-[#5F6B85]">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      {e.body && (
                        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{e.body}</p>
                      )}
                      <div className="mt-1 flex gap-4">
                        {e.sourceUrl && (
                          <a
                            href={e.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#5B8CFF] hover:underline"
                          >
                            Read the source →
                          </a>
                        )}
                        {e.href && (
                          <Link href={e.href} className="text-xs text-[#5B8CFF] hover:underline">
                            {e.hrefLabel}
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
