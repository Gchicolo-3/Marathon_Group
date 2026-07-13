'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';

// Runs the pending-draft quality review server-side: drafts that fail the
// voice check are rewritten, drafts that pass are left alone.
export function RegenerateDraftsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { kind: 'ok'|'err', text }

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/drafts/regenerate', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Draft review failed');
      const text =
        data.checked === 0
          ? 'No pending drafts to review.'
          : `Reviewed ${data.checked} pending draft${data.checked === 1 ? '' : 's'} — ` +
            `${data.regenerated} rewritten, ${data.passed} already on-voice.` +
            (data.warning ? ` ⚠ ${data.warning}` : '');
      setResult({ kind: data.warning ? 'warn' : 'ok', text });
      router.refresh();
    } catch (err) {
      setResult({ kind: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={run} disabled={busy} variant="outline">
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? 'Reviewing drafts…' : 'Review & refresh drafts'}
      </Button>
      {result && (
        <p
          className={`max-w-sm text-right text-xs ${
            result.kind === 'ok'
              ? 'text-emerald-400'
              : result.kind === 'warn'
                ? 'text-[#E8C25B]'
                : 'text-red-400'
          }`}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
