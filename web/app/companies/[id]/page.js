'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Save, Loader2, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Skeleton } from '../../../components/ui/skeleton';
import { StageBadge } from '../../../components/stage-badge';

export default function CompanyDetailPage() {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({});
  const [adding, setAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', title: '', email: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [coRes, ctRes, dlRes] = await Promise.all([
      fetch(`/api/companies/${id}`),
      fetch('/api/contacts'),
      fetch('/api/deals'),
    ]);
    if (coRes.ok) setCompany(await coRes.json());
    if (ctRes.ok) setContacts((await ctRes.json()).filter((c) => String(c.company_id) === String(id)));
    if (dlRes.ok) setDeals((await dlRes.json()).filter((d) => String(d.company_id) === String(id)));
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function saveCompany() {
    setBusy('save');
    setError('');
    const res = await fetch(`/api/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    });
    setBusy('');
    if (res.ok) {
      setEditing(false);
      load();
    } else setError('Failed to save company');
  }

  async function addContact(e) {
    e.preventDefault();
    setBusy('contact');
    setError('');
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: Number(id),
        name: newContact.name.trim(),
        title: newContact.title.trim() || null,
        email: newContact.email.trim() || null,
      }),
    });
    setBusy('');
    if (res.ok) {
      setAdding(false);
      setNewContact({ name: '', title: '', email: '' });
      load();
    } else setError('Failed to add contact');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Company not found. <Link href="/companies" className="underline">Back to companies</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/companies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Companies
      </Link>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{company.industry || 'No industry set'}</p>
        </div>
        {!editing && (
          <Button
            variant="outline"
            onClick={() => {
              setEdit({ name: company.name, industry: company.industry || '', notes: company.notes || '' });
              setEditing(true);
            }}
          >
            <Pencil /> Edit
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {editing && (
        <Card className="mb-5">
          <CardContent className="space-y-3 pt-5">
            <Input value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} placeholder="Company name" />
            <Input value={edit.industry} onChange={(e) => setEdit((s) => ({ ...s, industry: e.target.value }))} placeholder="Industry" />
            <Textarea value={edit.notes} onChange={(e) => setEdit((s) => ({ ...s, notes: e.target.value }))} placeholder="Notes…" className="min-h-[90px]" />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveCompany} disabled={!!busy}>
                {busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />} Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={!!busy}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!editing && company.notes && (
        <Card className="mb-5">
          <CardContent className="pt-5 text-sm whitespace-pre-wrap">{company.notes}</CardContent>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Contacts ({contacts.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
              <Plus /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {adding && (
              <form onSubmit={addContact} className="space-y-2 rounded-lg border p-3">
                <Input placeholder="Name" value={newContact.name} onChange={(e) => setNewContact((s) => ({ ...s, name: e.target.value }))} autoFocus />
                <Input placeholder="Title" value={newContact.title} onChange={(e) => setNewContact((s) => ({ ...s, title: e.target.value }))} />
                <Input placeholder="Email" type="email" value={newContact.email} onChange={(e) => setNewContact((s) => ({ ...s, email: e.target.value }))} />
                <Button size="sm" type="submit" disabled={!!busy || !newContact.name.trim()}>
                  {busy === 'contact' ? <Loader2 className="animate-spin" /> : <Plus />} Add contact
                </Button>
              </form>
            )}
            {contacts.length === 0 && !adding ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No contacts yet.</p>
            ) : (
              <ul className="divide-y">
                {contacts.map((c) => (
                  <li key={c.id} className="py-2.5 text-sm">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-muted-foreground">{c.title || '—'}</p>
                    {c.email && <p className="text-muted-foreground">{c.email}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deals ({deals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No deals for this company.</p>
            ) : (
              <ul className="divide-y">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/deal/${d.id}`} className="font-medium text-blue-700 hover:underline">
                        {d.contact_name}
                      </Link>
                      <p className="text-muted-foreground">score {d.score ?? '—'} · week {d.campaign_week ?? 1}</p>
                    </div>
                    <StageBadge stage={d.stage} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
