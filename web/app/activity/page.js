import Link from 'next/link';
import {
  StickyNote, ArrowRightLeft, Mail, Sparkles, Bot, Search,
  ClipboardCheck, FileText, Newspaper, Activity as ActivityIcon,
} from 'lucide-react';
import { listActivityFeed } from '../../lib/queries';
import { Card, CardContent } from '../../components/ui/card';
import { cn } from '../../lib/utils';

export const dynamic = 'force-dynamic';

// One readable label + icon per feed entry type — deal activities and agent
// runs share the feed.
const TYPE_META = {
  note:             { label: 'Note',            icon: StickyNote },
  stage_change:     { label: 'Stage change',    icon: ArrowRightLeft },
  email_sent:       { label: 'Email sent',      icon: Mail },
  ai_regenerate:    { label: 'AI draft',        icon: Sparkles },
  lead_pull:        { label: 'Prospector run',  icon: Search },
  qualification:    { label: 'Qualifier run',   icon: ClipboardCheck },
  draft_generation: { label: 'Copywriter run',  icon: FileText },
  daily_digest:     { label: 'Daily digest',    icon: Mail },
  news_scan:        { label: 'News scan',       icon: Newspaper },
  morning_brief:    { label: 'Morning brief',   icon: Mail },
};

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// Agent-run rows have no free-text notes — describe them from their counts.
function runSummary(entry) {
  if (entry.errors) return `Failed: ${entry.errors}`;
  if (entry.type === 'lead_pull') return `Added ${entry.prospects_found ?? 0} new prospect${entry.prospects_found === 1 ? '' : 's'}`;
  if (entry.type === 'qualification') return `Scored ${entry.prospects_found ?? 0} prospect${entry.prospects_found === 1 ? '' : 's'} against the ICP`;
  if (entry.type === 'draft_generation') return `Drafted ${entry.drafts_created ?? 0} email${entry.drafts_created === 1 ? '' : 's'} for review`;
  if (entry.type === 'news_scan') return `Found ${entry.prospects_found ?? 0} new signal${entry.prospects_found === 1 ? '' : 's'}`;
  if (entry.type === 'daily_digest') return 'Daily digest generated';
  return 'Completed';
}

export default async function ActivityPage() {
  const feed = await listActivityFeed();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Everything the system and the agents have done, newest first — the audit trail behind
          your pipeline.
        </p>
      </div>

      {feed.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <ActivityIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No activity yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Agent runs, notes, stage changes, drafts, and sends will show up here as the
            pipeline works.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ol className="divide-y">
              {feed.map((entry) => {
                const meta = TYPE_META[entry.type] || { label: entry.type, icon: Bot };
                const Icon = meta.icon;
                const isRun = entry.kind === 'agent_run';
                return (
                  <li key={`${entry.kind}-${entry.id}`} className="flex gap-3 px-4 py-3">
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        isRun ? 'bg-[#5B8CFF]/15' : 'bg-secondary'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', isRun ? 'text-[#7FA0F0]' : 'text-muted-foreground')} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium">{meta.label}</span>
                        {entry.contact_name && (
                          <Link
                            href={`/deal/${entry.deal_id}`}
                            className="truncate text-sm text-[#5B8CFF] hover:underline"
                          >
                            {entry.contact_name}
                            {entry.company_name ? ` · ${entry.company_name}` : ''}
                          </Link>
                        )}
                        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                        {entry.notes || runSummary(entry)}
                      </p>
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
