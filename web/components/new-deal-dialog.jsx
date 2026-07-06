'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { STAGE_ORDER, STAGE_META } from './stage-badge';

const NEW = '__new__';

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const selectCls =
  'h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function NewDealDialog({ open, onClose, companies, contacts, onCreated }) {
  const [companyId, setCompanyId] = useState(NEW);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactId, setContactId] = useState(NEW);
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [score, setScore] = useState('');
  const [stage, setStage] = useState('new');
  const [source, setSource] = useState('manual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const companyContacts = useMemo(
    () => contacts.filter((c) => String(c.company_id) === String(companyId)),
    [contacts, companyId]
  );

  async function expectOk(res, fallback) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || fallback);
    }
    return res.json();
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let cid = companyId;
      if (cid === NEW) {
        if (!companyName.trim()) throw new Error('Company name is required');
        const co = await expectOk(
          await fetch('/api/companies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: companyName.trim(), industry: industry.trim() || null }),
          }),
          'Failed to create company'
        );
        cid = co.id;
      }

      let ctid = contactId;
      if (ctid === NEW || companyId === NEW) {
        if (!contactName.trim()) throw new Error('Contact name is required');
        const ct = await expectOk(
          await fetch('/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_id: cid,
              name: contactName.trim(),
              title: contactTitle.trim() || null,
              email: contactEmail.trim() || null,
            }),
          }),
          'Failed to create contact'
        );
        ctid = ct.id;
      }

      await expectOk(
        await fetch('/api/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_id: ctid,
            company_id: cid,
            score: score === '' ? null : Number(score),
            stage,
            source: source.trim() || null,
          }),
        }),
        'Failed to create deal'
      );

      // reset for next open
      setCompanyId(NEW); setCompanyName(''); setIndustry('');
      setContactId(NEW); setContactName(''); setContactTitle(''); setContactEmail('');
      setScore(''); setStage('new'); setSource('manual');
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>New deal</DialogTitle>
      <DialogDescription>Add a deal to the pipeline — pick an existing company/contact or create new ones.</DialogDescription>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Company">
          <select
            className={selectCls}
            value={companyId}
            onChange={(e) => { setCompanyId(e.target.value); setContactId(NEW); }}
          >
            <option value={NEW}>+ New company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        {companyId === NEW && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company name">
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Health" />
            </Field>
            <Field label="Industry">
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Healthcare" />
            </Field>
          </div>
        )}

        <Field label="Contact">
          <select className={selectCls} value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={companyId === NEW}>
            <option value={NEW}>+ New contact…</option>
            {companyContacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ''}</option>
            ))}
          </select>
        </Field>
        {(contactId === NEW || companyId === NEW) && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name">
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Smith" />
            </Field>
            <Field label="Title">
              <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="VP of Facilities" />
            </Field>
            <Field label="Email">
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@acme.org" type="email" />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Score (1–10)">
            <Input value={score} onChange={(e) => setScore(e.target.value)} type="number" min="1" max="10" placeholder="—" />
          </Field>
          <Field label="Stage">
            <select className={selectCls} value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_META[s].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Source">
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Create deal
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
