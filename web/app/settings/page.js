'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { GmailButton, CadencePicker, VoiceSamples, saveSettings } from '../../components/keepwarm/pieces';

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-1 h-5 w-5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function SettingsPageInner() {
  const params = useSearchParams();
  const [s, setS] = useState(null);
  const [signOff, setSignOff] = useState('');
  const [weeklyMax, setWeeklyMax] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/keepwarm/setup').then((x) => x.json());
    setS(r);
    setSignOff(r.settings?.sign_off || '');
    setWeeklyMax(String(r.settings?.weekly_max || 10));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function patch(p, note = 'Saved') {
    setMsg('');
    try {
      await saveSettings(p);
      setMsg(note);
      await load();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Gmail? Nothing can be sent until you connect again.')) return;
    setBusy(true);
    await fetch('/api/google/status', { method: 'DELETE' }).catch(() => {});
    setBusy(false);
    await load();
  }

  if (!s) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      {params.get('gmail') === 'error' && <p className="text-sm text-red-400">{params.get('detail')}</p>}
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Gmail</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <GmailButton gmail={s.gmail} configured={s.google_configured} />
          {s.gmail && (
            <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Disconnect Gmail
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            checked={!!s.settings.paused}
            onChange={(v) => patch({ paused: v }, v ? 'Paused. No new notes on Sundays.' : 'Back on. New notes this Sunday.')}
            label="Pause everything"
            hint="Vacation, busy month, whatever. Nothing new gets written until you turn this off."
          />
          <Toggle
            checked={!!s.settings.digest}
            onChange={(v) => patch({ digest: v })}
            label="Sunday email to myself"
            hint="A short email from your Gmail to your Gmail listing who is up that week."
          />
          <div className="space-y-2">
            <div className="text-sm font-medium">Default touch</div>
            <CadencePicker value={s.settings.default_cadence_days} onSaved={() => load()} />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Most notes per week</div>
            <div className="flex gap-2">
              <Input type="number" min={1} max={50} value={weeklyMax} onChange={(e) => setWeeklyMax(e.target.value)} className="w-24" />
              <Button variant="outline" onClick={() => patch({ weekly_max: Number(weeklyMax) })}>Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">How notes are signed</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full rounded-md border border-input bg-card p-2 text-sm"
            rows={3}
            value={signOff}
            onChange={(e) => setSignOff(e.target.value)}
          />
          <Button variant="outline" onClick={() => patch({ sign_off: signOff })}>Save sign off</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Your writing</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Emails you wrote. Notes are written to match these.</p>
          <VoiceSamples initial={s.settings.voice_samples} onSaved={load} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}
