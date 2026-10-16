'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Loader2, Unplug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button, buttonVariants } from './ui/button';

// Connect Gmail card on /runs. One click sends Mike to Google's Allow
// screen (/api/google/connect); the callback bounces back here with
// ?gmail=connected or ?gmail=error.
export function GmailConnect() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState(null); // null = loading
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null); // { kind, text }

  useEffect(() => {
    fetch('/api/google/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, configured: false, error: 'Could not load status' }));
  }, []);

  useEffect(() => {
    const flag = params.get('gmail');
    if (!flag) return;
    const detail = params.get('detail') || '';
    setFlash(
      flag === 'connected'
        ? { kind: 'ok', text: `Gmail connected${detail ? ` as ${detail}` : ''}. Approve now sends from that address.` }
        : { kind: 'err', text: `Gmail connect failed. ${detail}` }
    );
    // Drop the flags so a refresh does not repeat the message.
    router.replace('/runs');
  }, [params, router]);

  async function disconnect() {
    if (!window.confirm('Disconnect Gmail? Approve goes back to opening your mail client until you reconnect.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/google/status', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setStatus({ connected: false, configured: true });
      setFlash({ kind: 'ok', text: 'Gmail disconnected.' });
    } catch (err) {
      setFlash({ kind: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Gmail</CardTitle>
        <p className="text-xs text-muted-foreground">
          Connect the Gmail account the outreach should come from. Approve then sends the email
          from that address and replies are read automatically every 15 minutes on weekdays.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        ) : status.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
              <Mail className="h-4 w-4" /> Connected as <span className="font-medium">{status.email}</span>
            </span>
            <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Unplug />} Disconnect
            </Button>
          </div>
        ) : !status.configured ? (
          <p className="text-sm text-[#E8C25B]">
            Not configured yet. Add {(status.missing || []).join(', ') || 'the Google env vars'} in Vercel and redeploy.
          </p>
        ) : status.error ? (
          <p className="text-sm text-[#E8C25B]">{status.error} (button 1 above).</p>
        ) : (
          <a href="/api/google/connect" className={buttonVariants()}>
            <Mail /> Connect Gmail
          </a>
        )}
        {flash && (
          <p className={`text-xs ${flash.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{flash.text}</p>
        )}
      </CardContent>
    </Card>
  );
}
