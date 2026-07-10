import { cn } from '../lib/utils';

export const STAGE_ORDER = ['new', 'qualified', 'contacted', 'replied', 'meeting_set', 'won', 'lost'];

export const STAGE_META = {
  new:         { label: 'New',         badge: 'bg-white/5 text-slate-300 border-white/10',     dot: 'bg-slate-400' },
  qualified:   { label: 'Qualified',   badge: 'bg-[#5B8CFF]/10 text-[#7FA0F0] border-[#5B8CFF]/30',         dot: 'bg-[#5B8CFF]' },
  contacted:   { label: 'Contacted',   badge: 'bg-amber-400/10 text-amber-300 border-amber-400/30',      dot: 'bg-amber-400' },
  replied:     { label: 'Replied',     badge: 'bg-violet-400/10 text-violet-300 border-violet-400/30',   dot: 'bg-violet-400' },
  meeting_set: { label: 'Meeting set', badge: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',         dot: 'bg-cyan-400' },
  won:         { label: 'Won',         badge: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30', dot: 'bg-emerald-400' },
  lost:        { label: 'Lost',        badge: 'bg-red-400/10 text-red-300 border-red-400/30',            dot: 'bg-red-400' },
};

export const DRAFT_STATUS_META = {
  pending:  'bg-amber-400/10 text-amber-300 border-amber-400/30',
  approved: 'bg-[#5B8CFF]/10 text-[#7FA0F0] border-[#5B8CFF]/30',
  sent:     'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
};

export function StageBadge({ stage, className }) {
  const meta = STAGE_META[stage] || STAGE_META.new;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        meta.badge,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

export function DraftStatusBadge({ status, className }) {
  if (!status) {
    return (
      <span className={cn('inline-flex items-center rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground', className)}>
        no draft
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        DRAFT_STATUS_META[status] || 'bg-secondary text-secondary-foreground',
        className
      )}
    >
      {status}
    </span>
  );
}
