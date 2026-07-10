import {
  listDeals,
  listTriggerEvents,
  listAgentRuns,
  getLatestBrief,
  getPipelineStats,
} from '../lib/queries';
import { Dashboard } from '../components/dashboard';

export const dynamic = 'force-dynamic';

function briefDateLine(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago',
  });
  return `${date} · generated ${time}`;
}

export default async function HomePage() {
  const [deals, signals, runs, brief, stats] = await Promise.all([
    listDeals(),
    listTriggerEvents(5),
    listAgentRuns(6),
    getLatestBrief(),
    getPipelineStats(),
  ]);

  // Deals whose latest draft still needs a human — highest score first
  // (listDeals already sorts that way).
  const drafts = deals
    .filter((d) => d.draft_status === 'pending')
    .map((d) => ({
      id: d.id,
      name: d.contact_name,
      title: d.contact_title,
      company: d.company_name,
      subject: d.draft_subject,
      generatedAt: d.draft_generated_at,
    }));

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-7 px-0 pb-12 pt-3 lg:px-4">
      {/* Today's Brief — written by the morning-brief agent (agent_runs.notes) */}
      <section className="rounded-[14px] border border-[#5B8CFF]/[0.22] bg-gradient-to-b from-[#2E63E8]/10 to-[#2E63E8]/[0.03] px-[30px] py-[26px]">
        <div className="mb-3.5 flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 animate-[mgPulse_2.4s_ease-in-out_infinite] rounded-full bg-[#5B8CFF]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#7FA0F0]">
            Today&apos;s Brief
          </span>
          {brief && (
            <span className="ml-auto font-mono text-[11px] text-[#5F6B85]">
              {briefDateLine(brief.created_at)}
            </span>
          )}
        </div>
        {brief ? (
          <div className="flex max-w-[920px] flex-col gap-2">
            {brief.notes.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} className="m-0 text-[15.5px] leading-[1.65] text-[#C9D4E8]">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="m-0 text-[15.5px] leading-[1.65] text-[#C9D4E8]">
            No brief generated yet — the pipeline writes one each weekday morning (7 AM ET).
          </p>
        )}
      </section>

      <Dashboard initialDrafts={drafts} signals={signals} runs={runs} stats={stats} />
    </div>
  );
}
