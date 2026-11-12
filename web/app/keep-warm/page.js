'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Send, RotateCcw, SkipForward, Loader2, Sparkles, MessageCircleReply, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

function fmt(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

function NoteCard({ note, gmail, onGone, onUpdated }) {
  const [subject, setSubject] = useState(note.subject || '');
  const [body, setBody] = useState(note.body || '');
  const [instructions, setInstructions] = useState('');
  const [showRedo, setShowRedo] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function act(action, extra = {}) {
    setBusy(action);
    setError('');
    try {
      const res = await fetch(`/api/keepwarm/touches/${note.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      if (action === 'redo') {
        setSubject(data.subject);
        setBody(data.body);
        setInstructions('');
        setShowRedo(false);
        onUpdated?.();
      } else {
        onGone(action, note);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const company = note.company && note.company !== 'Personal network' ? note.company : '';
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[15px] font-semibold">{note.name}</span>
          <span className="text-xs text-muted-foreground">{[note.title, company].filter(Boolean).join(', ')}</span>
          <span className="ml-auto text-xs text-muted-foreground">{note.last_touch_at ? `last note ${fmt(note.last_touch_at)}` : 'first note'}</span>
        </div>
        {note.relationship_note && <p className="text-xs text-muted-foreground">Your note: {note.relationship_note}</p>}
        <p className="text-xs text-muted-foreground">To {note.email}</p>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="text-[15px] leading-relaxed" />

        {showRedo && (
          <div className="flex gap-2">
            <Input
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. mention the Lenox Hill job, ask about lunch"
              autoFocus
            />
            <Button variant="outline" onClick={() => act('redo', { instructions })} disabled={!!busy}>
              {busy === 'redo' ? <Loader2 className="animate-spin" /> : <Sparkles />} Rewrite
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="success" className="h-11 flex-1 text-[15px]" onClick={() => act('send', { subject, body })} disabled={!!busy || !gmail}>
            {busy === 'send' ? <Loader2 className="animate-spin" /> : <Send />} Send
          </Button>
          <Button variant="outline" className="h-11" onClick={() => setShowRedo(!showRedo)} disabled={!!busy}>
            <RotateCcw /> Redo
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => act('skip')} disabled={!!busy}>
            {busy === 'skip' ? <Loader2 className="animate-spin" /> : <SkipForward />} Skip
          </Button>
        </div>
        {!gmail && <p className="text-xs text-amber-400">Connect Gmail in Settings to send.</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default function KeepWarmPage() {
  const [data, setData] = useState(null);
  const [setup, setSetup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [q, s] = await Promise.all([
      fetch('/api/keepwarm/queue').then((r) => r.json()),
      fetch('/api/keepwarm/setup').then((r) => r.json()),
    ]);
    if (q.error) setError(q.error);
    setData(q.error ? { queue: [], sent: [] } : q);
    setSetup(s);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function writeNow() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/keepwarm/queue', { method: 'POST' });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || 'Could not write notes');
      setFlash(r.drafted ? `Wrote ${r.drafted} ${r.drafted === 1 ? 'note' : 'notes'}.` : 'Nobody is due this week. Use "Note this week" on the People page to pull someone forward.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function gone(action, note) {
    setFlash(action === 'send' ? `Sent to ${note.name}.` : `Skipped ${note.name}. They come back around on their normal schedule.`);
    setData((d) => ({ ...d, queue: d.queue.filter((x) => x.id !== note.id) }));
    if (action === 'send') load();
  }

  if (!data || !setup) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const needsSetup = !setup.settings?.setup_done;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">This week</h1>
        <p className="text-sm text-muted-foreground">
          Short notes to people in your network, written in your voice. Edit anything, tap Send, and it goes from your Gmail. Nothing sends on its own.
        </p>
      </div>

      {needsSetup && (
        <Link href="/start" className="flex items-center gap-3 rounded-lg border border-[#5B8CFF]/40 bg-[#5B8CFF]/10 p-4 text-sm">
          <Sparkles className="h-5 w-5 text-[#5B8CFF]" />
          <span className="flex-1"><span className="font-semibold">Finish setup.</span> Three quick steps and your first notes are ready.</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {setup.settings?.paused && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          Paused. No new notes get written on Sundays until you turn it back on in <Link href="/settings" className="underline">Settings</Link>.
        </p>
      )}

      {flash && <p className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> {flash}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {data.queue.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {setup.people
                ? 'No notes waiting. New ones are written every Sunday morning for whoever is due.'
                : 'Import your contacts first and this fills up.'}
            </p>
            {setup.people > 0 && (
              <Button onClick={writeNow} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Write this week&apos;s notes now
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium">{data.queue.length} waiting</p>
          {data.queue.map((n) => (
            <NoteCard key={n.id} note={n} gmail={!!setup.gmail} onGone={gone} />
          ))}
        </div>
      )}

      {data.sent.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recently sent</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-0">
            {data.sent.map((s) => (
              <div key={s.id} className="flex items-start gap-3 border-t border-white/5 pt-2 text-sm">
                <div className="flex-1">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground"> {fmt(s.sent_at)}</span>
                  {s.reply_snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">&ldquo;{s.reply_snippet}&rdquo;</p>}
                </div>
                {s.replied_at && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                    <MessageCircleReply className="h-3 w-3" /> Replied
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
