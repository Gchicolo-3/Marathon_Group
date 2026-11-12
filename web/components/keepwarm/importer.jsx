'use client';

import { useState } from 'react';
import { Upload, Loader2, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Button } from '../ui/button';
import { mapHeaders, normalizeRow, findHeaderRow } from '../../lib/keepwarm-parse';

const CHUNK = 100;

// Excel or CSV upload. Parses every tab in the browser, guesses the columns
// from the headers, shows a preview, then sends the rows in chunks.
export function Importer({ onDone }) {
  const [tabs, setTabs] = useState(null); // [{ name, rows, include, withEmail, mapped }]
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResult(null);
    setBusy('Reading your file');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const parsed = wb.SheetNames.map((name) => {
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
        const h = findHeaderRow(raw);
        if (h < 0) return { name, rows: [], include: false, withEmail: 0, mapped: [] };
        const map = mapHeaders(raw[h]);
        const rows = raw.slice(h + 1).map((r) => normalizeRow(r, map, wb.SheetNames.length > 1 ? name : null)).filter(Boolean);
        return {
          name,
          rows,
          include: rows.length > 0,
          withEmail: rows.filter((r) => r.email).length,
          mapped: Object.keys(map),
        };
      });
      setFileName(file.name);
      setTabs(parsed);
      if (!parsed.some((t) => t.rows.length)) {
        setError('Could not find a Name or Email column in any tab. Make sure the first row has headers like Name, Email, Company.');
      }
    } catch (err) {
      setError(`Could not read that file: ${err.message}`);
    } finally {
      setBusy('');
      e.target.value = '';
    }
  }

  async function run() {
    const rows = tabs.filter((t) => t.include).flatMap((t) => t.rows);
    const total = { created: 0, updated: 0, skipped: 0, no_email: 0 };
    setError('');
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        setBusy(`Importing ${Math.min(i + CHUNK, rows.length)} of ${rows.length}`);
        const res = await fetch('/api/keepwarm/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: rows.slice(i, i + CHUNK), startIndex: i }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Import failed');
        for (const k of Object.keys(total)) total[k] += data[k] || 0;
      }
      setResult(total);
      setTabs(null);
      onDone?.(total);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const selected = tabs ? tabs.filter((t) => t.include) : [];
  const count = selected.reduce((n, t) => n + t.rows.length, 0);
  const preview = selected[0]?.rows.slice(0, 4) || [];

  return (
    <div className="space-y-3">
      {!tabs && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-8 text-center hover:border-[#5B8CFF]/60 hover:bg-white/[0.02]">
          {busy ? <Loader2 className="h-6 w-6 animate-spin text-[#5B8CFF]" /> : <Upload className="h-6 w-6 text-[#5B8CFF]" />}
          <span className="text-sm font-medium">{busy || 'Tap to choose your Excel or CSV file'}</span>
          <span className="text-xs text-muted-foreground">Every tab is read. Columns like Name, Email, Company, Title, Notes are picked up on their own.</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={pick} disabled={!!busy} />
        </label>
      )}

      {tabs && (
        <div className="space-y-3 rounded-lg border border-white/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileSpreadsheet className="h-4 w-4 text-[#5B8CFF]" /> {fileName}
          </div>
          <div className="space-y-1">
            {tabs.map((t, i) => (
              <label key={t.name} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-white/[0.03]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={t.include}
                  disabled={!t.rows.length}
                  onChange={(e) => setTabs(tabs.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                />
                <span className="font-medium">{t.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {t.rows.length ? `${t.rows.length} people, ${t.withEmail} with email` : 'no Name or Email column found'}
                </span>
              </label>
            ))}
          </div>
          {preview.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-white/5">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>{['Name', 'Email', 'Company', 'Note'].map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-2 py-1.5">{r.name}</td>
                      <td className="px-2 py-1.5">{r.email || <span className="text-amber-400">missing</span>}</td>
                      <td className="px-2 py-1.5">{r.company}</td>
                      <td className="max-w-[200px] truncate px-2 py-1.5">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            People without an email still come in. You can add their email later on the People page. Importing the same file again updates people instead of doubling them.
          </p>
          <div className="flex gap-2">
            <Button onClick={run} disabled={!count || !!busy} className="flex-1">
              {busy ? <Loader2 className="animate-spin" /> : null} {busy || `Import ${count} people`}
            </Button>
            <Button variant="outline" onClick={() => setTabs(null)} disabled={!!busy}>Cancel</Button>
          </div>
        </div>
      )}

      {result && (
        <p className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          {result.created} added, {result.updated} updated{result.no_email ? `, ${result.no_email} need an email` : ''}.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
