import Link from 'next/link';
import { FileText, Send, MessageCircle, Sparkles, Sunrise, Users, Inbox, Repeat, Radar } from 'lucide-react';
import { listDeals, listCompanies, listContacts, getLatestBrief, getPipelineStats } from '../lib/queries';
import { getDigest } from '../lib/digest';
import { Card, CardContent } from '../components/ui/card';
import { Board } from '../components/board';

export const dynamic = 'force-dynamic';

function Stat({ icon: Icon, label, value, href }) {
  const inner = (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2 shadow-sm transition-shadow hover:shadow">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function StatCard({ icon: Icon, label, value, href }) {
  const inner = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3.5 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <Icon className="h-5 w-5 text-blue-600" />
        </span>
        <div>
          <p className="text-2xl font-bold leading-tight tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function briefDateLabel(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export default async function PipelinePage() {
  const [deals, companies, contacts, digest, brief, stats] = await Promise.all([
    listDeals(),
    listCompanies(),
    listContacts(),
    getDigest(),
    getLatestBrief(),
    getPipelineStats(),
  ]);

  return (
    <>
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2.5">
            <Sunrise className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-semibold">Today&apos;s Brief</h2>
            {brief && (
              <span className="ml-auto text-xs text-muted-foreground">
                {briefDateLabel(brief.created_at)}
              </span>
            )}
          </div>
          {brief ? (
            <div className="mt-3 space-y-1.5">
              {brief.notes.split('\n').filter(Boolean).map((line, i) => (
                <p key={i} className="text-sm leading-relaxed">{line}</p>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No brief generated yet — pipeline runs at 7am ET.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Prospects in system" value={stats.total_prospects} />
        <StatCard icon={Inbox} label="Emails pending approval" value={stats.pending_approval} href="/queue" />
        <StatCard icon={Repeat} label="Active sequences" value={stats.active_sequences} />
        <StatCard icon={Radar} label="Signals this week" value={stats.signals_week} href="/signals" />
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        <Stat icon={Sparkles} label="Awaiting scoring" value={digest.unscored} />
        <Stat icon={FileText} label="Drafted (24h)" value={digest.drafted_24h} />
        <Stat icon={Send} label="Sent (24h)" value={digest.sent_24h} />
        <Stat icon={MessageCircle} label="In Replied" value={digest.replied_now} />
      </div>

      <Board initialDeals={deals} companies={companies} contacts={contacts} />
    </>
  );
}
