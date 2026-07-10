'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, SkipForward, Loader2, Inbox, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button, buttonVariants } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { StageBadge } from '../../components/stage-badge';
import { cn } from '../../lib/utils';

// Review flow for every deal whose latest draft is still pending:
// edit -> approve (or regenerate / skip) -> next.
export default function QueuePage() {
  const [queue, setQueue] = useState(null); // deals with pending drafts
  const [index, setIndex] = useState(0);
  const [deal, setDeal] = useState(null); // full detail of current
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(0); // approved this session

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/deals');
        if (!res.ok) return setQueue([]);
        const deals = await res.json();
        setQueue(deals.filter((d) => d.draft_status === 'pending'));
      } catch {
        setQueue([]);
      }
    })();
  }, []);

  const safeIndex = queue && queue.length > 0 ? Math.min(index, queue.length - 1) : 0;
  const current = queue && queue.length > 0 ? queue[safeIndex] : null;

  const loadCurrent = useCallback(async () => {
    if (!current) return;
    setDeal(null);
    try {
      const res = await fetch(`/api/deals/${current.id}`);
      if (res.ok) {
        const d = await res.json();
        setDeal(d);
        setSubject(d.draft_subject || '');
        setBody(d.draft_body || '');
      }
    } catch {
      // secondary fetch — never surface a banner over the loaded queue
    }
  }, [current]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  async function expectOk(res, fallback) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || fallback);
    }
    return res.json();
  }

  async function act(name, fn) {
    setBusy(name);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof TypeError ? 'Connection problem — please try again' : err.message);
    } finally {
      setBusy('');
    }
  }

  const approveAndNext = () =>
    act('approve', async () => {
      await expectOk(
        await fetch(`/api/deals/${current.id}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, body }),
        }),
        'Failed to save draft'
      );
      await expectOk(
        await fetch(`/api/deals/${current.id}/approve`, { method: 'POST' }),
        'Failed to approve'
      );
      setDone((n) => n + 1);
      const next = queue.filter((_, i) => i !== safeIndex);
      setQueue(next);
      setIndex((i) => Math.min(i, Math.max(next.length - 1, 0)));
    });

  const regenerate = () =>
    act('regenerate', async () => {
      const draft = await expectOk(
        await fetch(`/api/deals/${current.id}/regenerate`, { method: 'POST' }),
        'Failed to regenerate'
      );
      setSubject(draft.subject || '');
      setBody(draft.body || '');
    });

  const skip = () => {
    setError('');
    setIndex((i) => (i + 1 < queue.length ? i + 1 : 0));
  };

  if (queue === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h1 className="mt-4 text-lg font-semibold">Queue clear</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {done > 0
            ? `Nice — you approved ${done} draft${done === 1 ? '' : 's'}. Nothing left to review.`
            : 'No pending drafts to review.'}
        </p>
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'mt-5')}>
          Back to pipeline
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Approval queue</h1>
          <p className="text-sm text-muted-foreground">
            Reviewing {index + 1} of {queue.length} pending draft{queue.length === 1 ? '' : 's'}
            {done > 0 && ` · ${done} approved`}
          </p>
        </div>
        <div className="flex gap-1">
          {queue.map((_, i) => (
            <span
              key={i}
              className={cn('h-1.5 w-5 rounded-full', i === index ? 'bg-primary' : 'bg-secondary')}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">
              {current.contact_name} · {current.company_name}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {current.contact_title} · score {current.score ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StageBadge stage={current.stage} />
            <Link
              href={`/deal/${current.id}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
              title="Open deal"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!deal ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : busy === 'regenerate' ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-64 w-full" />
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Claude is redrafting this email…
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Body</label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[280px] leading-relaxed" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={approveAndNext} disabled={!!busy}>
                  {busy === 'approve' ? <Loader2 className="animate-spin" /> : <Check />} Approve & next
                </Button>
                <Button variant="outline" onClick={regenerate} disabled={!!busy}>
                  <Sparkles /> Regenerate
                </Button>
                <Button variant="ghost" onClick={skip} disabled={!!busy || queue.length < 2}>
                  <SkipForward /> Skip
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
