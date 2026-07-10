'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { Dialog, DialogTitle, DialogDescription } from '../../components/ui/dialog';

const selectCls =
  'h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export default function ContactsPage() {
  const [contacts, setContacts] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company_id: '', name: '', title: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [ctRes, coRes] = await Promise.all([fetch('/api/contacts'), fetch('/api/companies')]);
    if (ctRes.ok) setContacts(await ctRes.json());
    if (coRes.ok) setCompanies(await coRes.json());
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!contacts) return null;
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.title, c.email, c.company_name].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [contacts, query]);

  async function addContact(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: Number(form.company_id),
        name: form.name.trim(),
        title: form.title.trim() || null,
        email: form.email.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setForm({ company_id: '', name: '', title: '', email: '' });
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to create contact');
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {contacts ? `${contacts.length} contact${contacts.length === 1 ? '' : 's'}` : '…'}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-52 pl-8" />
        </div>
        <Button onClick={() => setOpen(true)}><Plus /> New contact</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!filtered ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">No contacts match.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Title</th>
                  <th className="px-4 py-2.5 font-semibold">Company</th>
                  <th className="px-4 py-2.5 font-semibold">Email</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.title || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/companies/${c.company_id}`} className="text-[#5B8CFF] hover:underline">
                        {c.company_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New contact</DialogTitle>
        <DialogDescription>Add a contact to an existing company.</DialogDescription>
        <form onSubmit={addContact} className="space-y-3">
          <select
            className={selectCls}
            value={form.company_id}
            onChange={(e) => setForm((s) => ({ ...s, company_id: e.target.value }))}
          >
            <option value="">Select company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
          <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !form.name.trim() || !form.company_id}>
              {busy && <Loader2 className="animate-spin" />} Create
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
