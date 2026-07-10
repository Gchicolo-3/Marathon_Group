import Link from 'next/link';
import { FileText, Send, Inbox, MessageCircle, Sparkles } from 'lucide-react';
import { listDeals, listCompanies, listContacts } from '../../lib/queries';
import { getDigest } from '../../lib/digest';
import { Board } from '../../components/board';

export const dynamic = 'force-dynamic';

function Stat({ icon: Icon, label, value, href }) {
  const inner = (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2 shadow-sm transition-colors hover:bg-accent">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function PipelinePage() {
  const [deals, companies, contacts, digest] = await Promise.all([
    listDeals(),
    listCompanies(),
    listContacts(),
    getDigest(),
  ]);

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2.5">
        <Stat icon={Inbox} label="Awaiting approval" value={digest.pending_approval} href="/queue" />
        <Stat icon={Sparkles} label="Awaiting scoring" value={digest.unscored} />
        <Stat icon={FileText} label="Drafted (24h)" value={digest.drafted_24h} />
        <Stat icon={Send} label="Sent (24h)" value={digest.sent_24h} />
        <Stat icon={MessageCircle} label="In Replied" value={digest.replied_now} />
      </div>
      <Board initialDeals={deals} companies={companies} contacts={contacts} />
    </>
  );
}
