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
      setResult({
        kind: 'ok',
        text: data.drafted === 0
          ? 'Run complete — no qualified deals were waiting for a draft'
          : `Run complete — drafted ${data.drafted} email${data.drafted === 1 ? '' : 's'}`,
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
