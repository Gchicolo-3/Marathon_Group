import { cn } from '../lib/utils';

// Color-coded trigger-event badges. The design's language — capital project =
// blue, people moves = green, money events = gold — extended to v2.1's full
// event_type set.
export const SIGNAL_META = {
  capital_project: {
    label: 'Capital Project',
    className: 'border-[#5B8CFF]/30 bg-[#5B8CFF]/[0.12] text-[#7FA0F0]',
  },
  leadership_change: {
    label: 'Leadership Change',
    className: 'border-[#4ADE80]/[0.28] bg-[#4ADE80]/10 text-[#4ADE80]',
  },
  funding: {
    label: 'Funding',
    className: 'border-[#E8C25B]/30 bg-[#E8C25B]/10 text-[#E8C25B]',
  },
  expansion: {
    label: 'Expansion',
    className: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  },
  acquisition: {
    label: 'Acquisition',
    className: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  },
  other: {
    label: 'Signal',
    className: 'border-white/10 bg-white/5 text-slate-300',
  },
};

export function SignalBadge({ kind, className }) {
  const meta = SIGNAL_META[kind] || SIGNAL_META.other;
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center rounded-[5px] border px-2 py-[3px] font-mono text-[10px] font-medium uppercase tracking-[0.08em]',
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
