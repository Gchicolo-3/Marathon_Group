'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Check, MessageCircleReply } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Importer } from '../../components/keepwarm/importer';

const CADENCES = [
  [30, 'Every month'],
  [60, 'Every 2 months'],
  [90, 'Every 3 months'],
  [180, 'Every 6 months'],
  [365, 'Once a year'],
];

function fmt(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

function PersonRow({ p, defaultCadence, onChanged }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(p.email || '');
  const [note, setNote] = useState(p.relationship_note || '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  async function save(patch, label) {
    setBusy(label);
    setMsg('');
    try {
      const res = await fetch(`/api/keepwarm/people/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setMsg('Saved');
      onChanged?.();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  }

  const company = p.company && p.company !== 'Personal network' ? p.company : '';
  return (
    <div className="border-t border-white/5 py-3 first:border-t-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{p.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[company, p.list_tab].filter(Boolean).join(' · ') || ' '}
          </div>
        </div>
        {p.last_reply_at && <MessageCircleReply className="h-4 w-4 text-emerald-400" />}
        <div className="text-right text-xs">
          {!p.email ? (
            <span className="text-amber-400">needs email</span>
          ) : p.has_pending ? (
            <span className="text-[#5B8CFF]">note waiting</span>
          ) : (
            <span className="text-muted-foreground">next {fmt(p.next_touch_at) || 'soon'}</span>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3 rounded-md bg-white/[0.02] p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Email</label>
            <div className="flex gap-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
              <Button variant="outline" onClick={() => save({ email }, 'email')} disabled={!!busy}>
                {busy === 'email' ? <Loader2 className="animate-spin" /> : <Check />}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Your note about them (the writer uses this)</label>
            <div className="flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. worked together at Montefiore, kids play hockey" />
              <Button variant="outline" onClick={() => save({ relationship_note: note }, 'note')} disabled={!!busy}>
                {busy === 'note' ? <Loader2 className="animate-spin" /> : <Check />}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">How often</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              value={p.cadence_days || ''}
              onChange={(e) => save({ cadence_days: e.target.value ? Number(e.target.value) : null }, 'cadence')}
            >
              <option value="">Default ({CADENCES.find(([d]) => d === defaultCadence)?.[1] || `${defaultCadence} days`})</option>
              {CADENCES.map(([d, l]) => <option key={d} value={d}>{l}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => save({ touch_now: true }, 'now')} disabled={!!busy || !p.email || p.has_pending}>
              Note this week
            </Button>
            <Button size="sm" variant="ghost" onClick={() => save({ keep_warm: false }, 'remove')} disabled={!!busy}>
              Remove from list
            </Button>
            {p.last_touch_at && <span className="self-center text-xs text-muted-foreground">Last note {fmt(p.last_touch_at)}</span>}
          </div>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </div>
      )}
    </div>
  );
}

export default function PeoplePage() {
  const [people, setPeople] = useState(null);
  const [defaultCadence, setDefaultCadence] = useState(90);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);

  async function load() {
    const [p, s] = await Promise.all([
      fetch('/api/keepwarm/people').then((r) => r.json()),
      fetch('/api/keepwarm/settings').then((r) => r.json()),
    ]);
    setPeople(Array.isArray(p) ? p : []);
    if (s.default_cadence_days) setDefaultCadence(s.default_cadence_days);
  }
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    if (!people) return [];
    const term = q.trim().toLowerCase();
    return people.filter((p) => {
      if (filter === 'email' && p.email) return false;
      if (filter === 'replied' && !p.last_reply_at) return false;
      if (!term) return true;
      return [p.name, p.company, p.email, p.list_tab].some((x) => (x || '').toLowerCase().includes(term));
    });
  }, [people, q, filter]);

  if (!people) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const missing = people.filter((p) => !p.email).length;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">People</h1>
          <p className="text-sm text-muted-foreground">{people.length} on your keep warm list{missing ? `, ${missing} need an email` : ''}. Tap anyone to change them.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)}>Import more</Button>
      </div>

      {showImport && (
        <Card><CardContent className="p-4"><Importer onDone={() => { load(); }} /></CardContent></Card>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, tab" className="pl-8" />
        </div>
        <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Everyone</option>
          <option value="email">Needs email</option>
          <option value="replied">Replied</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-4">
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{people.length ? 'Nobody matches.' : 'No one yet. Tap Import more to bring in your Excel file.'}</p>
          ) : (
            shown.map((p) => <PersonRow key={p.id} p={p} defaultCadence={defaultCadence} onChanged={load} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
