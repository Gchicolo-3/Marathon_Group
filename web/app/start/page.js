'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Importer } from '../../components/keepwarm/importer';
import { GmailButton, CadencePicker, VoiceSamples, saveSettings } from '../../components/keepwarm/pieces';

function Step({ n, title, done, optional, children }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          {done ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Step {n}{optional ? ', optional' : ''}</div>
            <div className="text-[15px] font-semibold">{title}</div>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function StartPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [s, setS] = useState(null);
  const [finishing, setFinishing] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/keepwarm/setup').then((x) => x.json());
    if (r.error) setError(r.error);
    setS(r);
    return r;
  }, []);

  useEffect(() => {
    load().then((r) => {
      if (r?.settings?.setup_done && !params.get('gmail')) router.replace('/keep-warm');
    });
  }, [load, params, router]);

  async function finish() {
    setError('');
    try {
      setFinishing('Saving');
      await saveSettings({ setup_done: true });
      setFinishing('Writing your first notes');
      const res = await fetch('/api/keepwarm/queue', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not write notes');
      router.push('/keep-warm');
    } catch (err) {
      setError(err.message);
      setFinishing('');
    }
  }

  if (!s) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const flag = params.get('gmail');
  const canFinish = s.gmail && s.people > 0;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Let&apos;s get you set up</h1>
        <p className="text-sm text-muted-foreground">
          About five minutes. When you&apos;re done, every Sunday you get a short list of people to say hi to, with the notes already written in your voice.
        </p>
      </div>

      {flag === 'connected' && <p className="text-sm text-emerald-400">Gmail connected. Nice.</p>}
      {flag === 'error' && <p className="text-sm text-red-400">{params.get('detail') || 'Gmail did not connect.'}</p>}

      <Step n={1} title="Connect your Gmail" done={!!s.gmail}>
        <p className="text-sm text-muted-foreground">Notes go out from your own address, and replies land in your normal inbox.</p>
        <GmailButton gmail={s.gmail} configured={s.google_configured} />
      </Step>

      <Step n={2} title="Bring in your people" done={s.people > 0}>
        {s.people > 0 && (
          <p className="text-sm text-emerald-400">{s.people} people in, {s.with_email} with an email. You can import more any time.</p>
        )}
        <Importer onDone={load} />
      </Step>

      <Step n={3} title="How often should you touch each person?" done>
        <p className="text-sm text-muted-foreground">This is the default. You can change it for anyone on the People page.</p>
        <CadencePicker value={s.settings.default_cadence_days} onSaved={load} />
      </Step>

      <Step n={4} title="Teach it how you write" optional done={s.voice_samples > 0}>
        <p className="text-sm text-muted-foreground">
          Paste two or three emails you&apos;ve sent to people you know. The more it sees, the more the notes sound like you and not a robot.
        </p>
        <VoiceSamples initial={s.settings.voice_samples} onSaved={load} />
      </Step>

      <Button className="h-12 w-full text-[15px]" onClick={finish} disabled={!canFinish || !!finishing}>
        {finishing ? <Loader2 className="animate-spin" /> : <Sparkles />} {finishing || 'Finish and write my first notes'}
      </Button>
      {!canFinish && <p className="text-center text-xs text-muted-foreground">Finish steps 1 and 2 to continue.</p>}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={null}>
      <StartPageInner />
    </Suspense>
  );
}
