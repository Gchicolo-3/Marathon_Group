'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Database, FlaskConical, ShieldCheck, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function AdminTools() {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [log, setLog] = useState([]); // newest last
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [probeOut, setProbeOut] = useState('');

  const say = (kind, text) => setLog((l) => [...l.slice(-7), { kind, text }]);

  async function run(key, fn) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      say('err', err instanceof TypeError ? 'Connection problem, try again' : err.message);
    } finally {
      setBusy('');
      router.refresh();
    }
  }

  const migrate = () =>
    run('migrate', async () => {
      const r = await post('/api/admin/migrate');
      say('ok', `Migration 005 done. ${JSON.stringify(r.result)}`);
    });

  const probe = () =>
    run('probe', async () => {
      const r = await post('/api/admin/probe', { name, company });
      setProbeOut(JSON.stringify(r, null, 2));
      say('ok', r.prospect_id ? 'Probe returned data. Copy the box below and send it over.' : 'No match for that person.');
    });

  const enrich = () =>
    run('enrich', async () => {
      const r = await post('/api/admin/enrich', { limit: 25 });
      say('ok', `Looked up ${r.attempted}. Verified ${r.verified}, no match ${r.no_match}. This month: ${r.usage.lookups_month} lookups.`);
    });

  const rescore = () =>
    run('rescore', async () => {
      let total = 0, passed = 0, remaining = 1, guard = 0;
      while (remaining > 0 && guard++ < 40) {
        const r = await post('/api/admin/rescore');
        total += r.scored; passed += r.passed; remaining = r.remaining;
        if (r.errors?.length) say('err', r.errors[0]);
        say('ok', `Scored ${total} so far, ${remaining} left`);
        if (r.scored === 0 && r.remaining > 0) break;
      }
      say('ok', `Rescore done. ${total} scored, ${passed} passed all four gates. No stages were changed.`);
    });

  return (
    <Card className="mb-5">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Phase two setup tools</CardTitle>
        <p className="text-xs text-muted-foreground">
          Run these in order, once. Each one is safe to repeat.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={migrate} disabled={!!busy}>
            {busy === 'migrate' ? <Loader2 className="animate-spin" /> : <Database />} 1. Run migration
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-[220px]" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input className="max-w-[260px]" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Button variant="outline" onClick={probe} disabled={!!busy || !name || !company}>
              {busy === 'probe' ? <Loader2 className="animate-spin" /> : <FlaskConical />} 2. Test Vibe on one person
            </Button>
          </div>
          {probeOut && (
            <textarea
              readOnly
              value={probeOut}
              onFocus={(e) => e.target.select()}
              className="h-40 w-full rounded-md border bg-card p-2 font-mono text-xs"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={enrich} disabled={!!busy}>
            {busy === 'enrich' ? <Loader2 className="animate-spin" /> : <ShieldCheck />} 3. Verify 25 contacts
          </Button>
          <Button variant="outline" onClick={rescore} disabled={!!busy}>
            {busy === 'rescore' ? <Loader2 className="animate-spin" /> : <Calculator />} 4. Rescore all deals
          </Button>
        </div>

        {log.length > 0 && (
          <div className="space-y-1 text-xs">
            {log.map((l, i) => (
              <p key={i} className={l.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{l.text}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
