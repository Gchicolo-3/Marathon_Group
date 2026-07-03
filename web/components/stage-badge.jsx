import { cn } from '../lib/utils';

export const STAGE_ORDER = ['new', 'qualified', 'contacted', 'replied', 'meeting_set', 'won', 'lost'];

export const STAGE_META = {
  new:         { label: 'New',         badge: 'bg-slate-100 text-slate-700 border-slate-200',     dot: 'bg-slate-400' },
  qualified:   { label: 'Qualified',   badge: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500' },
  contacted:   { label: 'Contacted',   badge: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500' },
  replied:     { label: 'Replied',     badge: 'bg-violet-50 text-violet-700 border-violet-200',   dot: 'bg-violet-500' },
  meeting_set: { label: 'Meeting set', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',         dot: 'bg-cyan-500' },
  won:         { label: 'Won',         badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  lost:        { label: 'Lost',        badge: 'bg-red-50 text-red-700 border-red-200',            dot: 'bg-red-400' },
};

export const DRAFT_STATUS_META = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  sent:     'bg-emerald-50 text-emerald-700 border-emerald-200',
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
