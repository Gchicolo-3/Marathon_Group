'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { Dialog, DialogTitle, DialogDescription } from '../../components/ui/dialog';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/companies');
    if (res.ok) setCompanies(await res.json());
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!companies) return null;
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q)
    );
  }, [companies, query]);

  async function addCompany(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), industry: industry.trim() || null }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setName('');
      setIndustry('');
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to create company');
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {companies ? `${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}` : '…'}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-52 pl-8" />
        </div>
        <Button onClick={() => setOpen(true)}><Plus /> New company</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!filtered ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">No companies match.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Company</th>
                  <th className="px-4 py-2.5 font-semibold">Industry</th>
                  <th className="px-4 py-2.5 font-semibold">Contacts</th>
                  <th className="px-4 py-2.5 font-semibold">Deals</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Link href={`/companies/${c.id}`} className="font-medium text-blue-700 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.industry || '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums">{c.contact_count}</td>
                    <td className="px-4 py-2.5 tabular-nums">{c.deal_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New company</DialogTitle>
        <DialogDescription>Add a company to the directory.</DialogDescription>
        <form onSubmit={addCompany} className="space-y-3">
          <Input placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input placeholder="Industry (optional)" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />} Create
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
