'use client';

import { useState } from 'react';
import { Loader2, Check, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

export const CADENCES = [
  [30, 'Every month'],
  [60, 'Every 2 months'],
  [90, 'Every 3 months'],
  [180, 'Every 6 months'],
  [365, 'Once a year'],
];

export async function saveSettings(patch) {
  const res = await fetch('/api/keepwarm/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not save');
  return data;
}

export function GmailButton({ gmail, configured }) {
  if (!configured) {
    return <p className="text-sm text-amber-400">Google sign in is not switched on yet. George is finishing it.</p>;
  }
  if (gmail) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm text-emerald-400"><Check className="h-4 w-4" /> Connected as {gmail.email}</span>
        <a href="/api/google/connect" className="text-xs text-muted-foreground underline-offset-4 hover:underline">Use a different account</a>
      </div>
    );
  }
  return (
    <a href="/api/google/connect" className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-[#1F1F1F] hover:bg-white/90">
      <Mail className="h-4 w-4" /> Connect Gmail
    </a>
  );
}

export function CadencePicker({ value, onSaved }) {
  const [busy, setBusy] = useState(null);
  async function pick(d) {
    setBusy(d);
    try {
      await saveSettings({ default_cadence_days: d });
      onSaved?.(d);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CADENCES.map(([d, label]) => (
        <button
          key={d}
          type="button"
          onClick={() => pick(d)}
          className={`flex h-11 items-center justify-center gap-2 rounded-md border text-sm ${
            value === d ? 'border-[#5B8CFF] bg-[#5B8CFF]/15 font-semibold' : 'border-white/10 hover:bg-white/[0.04]'
          }`}
        >
          {busy === d ? <Loader2 className="h-4 w-4 animate-spin" /> : value === d ? <Check className="h-4 w-4" /> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

export function VoiceSamples({ initial = [], onSaved }) {
  const [samples, setSamples] = useState(() => {
    const s = [...initial];
    while (s.length < 3) s.push('');
    return s;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      const out = await saveSettings({ voice_samples: samples });
      setMsg(`Saved ${out.voice_samples.length} ${out.voice_samples.length === 1 ? 'email' : 'emails'}. New notes will sound like these.`);
      onSaved?.(out.voice_samples.length);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {samples.map((s, i) => (
        <Textarea
          key={i}
          rows={4}
          value={s}
          onChange={(e) => setSamples(samples.map((x, j) => (j === i ? e.target.value : x)))}
          placeholder={i === 0 ? 'Paste an email you wrote to someone you know. Copy it from your Sent folder.' : `Email ${i + 1} (optional)`}
        />
      ))}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy || !samples.some((s) => s.trim())}>
          {busy && <Loader2 className="animate-spin" />} Save my emails
        </Button>
        {samples.length < 5 && (
          <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setSamples([...samples, ''])}>
            Add another
          </button>
        )}
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
