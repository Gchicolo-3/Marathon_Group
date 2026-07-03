'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ProspectDetailPage() {
  const { id } = useParams();
  const [prospect, setProspect] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState(null); // { kind: 'ok'|'err', text }

  const load = useCallback(async () => {
    const res = await fetch(`/api/prospects/${id}`);
    if (!res.ok) {
      setFlash({ kind: 'err', text: 'Failed to load prospect' });
      setLoading(false);
      return;
    }
    const data = await res.json();
    setProspect(data);
    setSubject(data.draft_subject || '');
    setBody(data.draft_body || '');
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveDraft() {
    setBusy('save');
    setFlash(null);
    const res = await fetch(`/api/prospects/${id}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    });
    setBusy('');
    if (res.ok) {
      setFlash({ kind: 'ok', text: 'Draft saved' });
    } else {
      const err = await res.json().catch(() => ({}));
      setFlash({ kind: 'err', text: err.error || 'Failed to save draft' });
    }
  }

  async function approve() {
    setBusy('approve');
    setFlash(null);
    // Persist any edits first so what gets approved is what's on screen.
    const saveRes = await fetch(`/api/prospects/${id}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    });
    if (!saveRes.ok) {
      setBusy('');
      setFlash({ kind: 'err', text: 'Failed to save draft before approving' });
      return;
    }
    const res = await fetch(`/api/prospects/${id}/approve`, { method: 'POST' });
    setBusy('');
    if (res.ok) {
      const data = await res.json();
      setProspect((p) => ({ ...p, draft_status: data.status }));
      setFlash({ kind: 'ok', text: 'Draft approved' });
    } else {
      const err = await res.json().catch(() => ({}));
      setFlash({ kind: 'err', text: err.error || 'Failed to approve draft' });
    }
  }

  async function send() {
    setBusy('send');
    setFlash(null);
    const res = await fetch(`/api/prospects/${id}/send`, { method: 'POST' });
    setBusy('');
    if (res.ok) {
      const data = await res.json();
      setProspect((p) => ({ ...p, draft_status: data.status }));
      setFlash({ kind: 'ok', text: 'Marked as sent — opening your mail client' });
      window.location.href = data.mailto;
    } else {
      const err = await res.json().catch(() => ({}));
      setFlash({ kind: 'err', text: err.error || 'Failed to send' });
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!prospect) return <p className="muted">Prospect not found.</p>;

  const hasDraft = prospect.draft_id != null;
  const status = prospect.draft_status;

  return (
    <>
      <a href="/" className="back-link">← All prospects</a>
      <h1>
        {prospect.first_name} {prospect.last_name}
      </h1>
      <p className="subtitle">
        {prospect.title} · {prospect.company}
      </p>

      <div className="detail-grid">
        <div className="panel">
          <h2>
            Drafted email{' '}
            {status ? <span className={`badge ${status}`}>{status}</span> : <span className="badge">no draft</span>}
          </h2>
          {!hasDraft ? (
            <p className="muted">No email has been drafted for this prospect yet.</p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="subject">Subject</label>
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="body">Body</label>
                <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <div className="actions">
                <button onClick={saveDraft} disabled={!!busy}>
                  {busy === 'save' ? 'Saving…' : 'Save draft'}
                </button>
                <button className="primary" onClick={approve} disabled={!!busy || status === 'sent'}>
                  {busy === 'approve' ? 'Approving…' : 'Approve'}
                </button>
                <button
                  className="success"
                  onClick={send}
                  disabled={!!busy || status !== 'approved'}
                  title={status !== 'approved' ? 'Approve the draft before sending' : undefined}
                >
                  {busy === 'send' ? 'Sending…' : 'Send'}
                </button>
              </div>
              {flash && <p className={`flash ${flash.kind}`}>{flash.text}</p>}
            </>
          )}
        </div>

        <div className="panel">
          <h2>Prospect</h2>
          <ul className="meta-list">
            <li><span className="k">Score</span>{prospect.qualification_score ?? '—'}</li>
            <li><span className="k">Email</span>{prospect.email || '—'}</li>
            <li><span className="k">Industry</span>{prospect.industry || '—'}</li>
            <li><span className="k">Location</span>{prospect.location || '—'}</li>
            <li><span className="k">Pipeline status</span>{prospect.status || '—'}</li>
            {prospect.linkedin_url && (
              <li>
                <span className="k">LinkedIn</span>
                <a href={prospect.linkedin_url} target="_blank" rel="noreferrer">
                  {prospect.linkedin_url}
                </a>
              </li>
            )}
            {prospect.qualification_notes && (
              <li><span className="k">Qualification notes</span>{prospect.qualification_notes}</li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
