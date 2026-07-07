'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

export function RunPipelineButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { kind: 'ok'|'err', text }

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/pipeline/run', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Pipeline run failed');
      const parts = [];
      if (data.scored) parts.push(`scored ${data.scored} (${data.qualified} qualified)`);
      if (data.drafted) parts.push(`drafted ${data.drafted} intro${data.drafted === 1 ? '' : 's'}`);
      if (data.follow_ups) parts.push(`${data.follow_ups} follow-up${data.follow_ups === 1 ? '' : 's'}`);
      if (data.errors?.length) parts.push(`errors: ${data.errors.join('; ')}`);
      setResult({
        kind: data.errors?.length ? 'err' : 'ok',
        text: parts.length ? `Run complete — ${parts.join(', ')}` : 'Run complete — nothing was due',
      });
      router.refresh();
    } catch (err) {
      setResult({ kind: 'err', text: err.message });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={run} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Play />}
        {busy ? 'Drafting emails…' : 'Run copywriter'}
      </Button>
      {result && (
        <p className={`text-xs ${result.kind === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}
