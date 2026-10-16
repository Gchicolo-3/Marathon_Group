'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button, buttonVariants } from './ui/button';

const FLAGS = {
  connected: 'Gmail connected.',
  denied: 'Google access was declined. Tap Connect Gmail to try again.',
  bad_state: 'That connection attempt expired. Tap Connect Gmail to try again.',
  error: 'Google connected but something failed on our side. Tap Connect Gmail again.',
  not_configured: 'Gmail is not set up yet. The Google keys are missing in Vercel.',
};

export function GmailConnect() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () =>
    fetch('/api/google/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false }));

  useEffect(() => {
    load();
    try {
      const flag = new URLSearchParams(window.location.search).get('gmail');
      if (flag && FLAGS[flag]) setMsg(FLAGS[flag]);
    } catch {}
  }, []);

  const check = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/check-replies', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Request failed (${res.status})`);
      setMsg(d.connected
        ? `Checked ${d.checked} threads. ${d.replies} new ${d.replies === 1 ? 'reply' : 'replies'}.${d.errors?.length ? ` ${d.errors.length} errors.` : ''}`
        : 'Gmail is not connected yet.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Gmail</CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect the mailbox emails send from. Approved emails go out from this address and replies are read automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {status?.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Connected as {status.email}
            </span>
            <Button variant="outline" onClick={check} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check replies now
            </Button>
            <a href="/api/google/connect" className={buttonVariants({ variant: 'outline' })}>Reconnect</a>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/google/connect"
              className={buttonVariants({ variant: 'default', className: status?.configured ? '' : 'pointer-events-none opacity-50' })}
            >
              <Mail /> Connect Gmail
            </a>
            {status && !status.configured && (
              <span className="text-sm text-muted-foreground">Needs the Google keys in Vercel first.</span>
            )}
            {status?.needs_migration && (
              <span className="text-sm text-muted-foreground">Run 1. Run migration below first.</span>
            )}
          </div>
        )}
        {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      </CardContent>
    </Card>
  );
}
