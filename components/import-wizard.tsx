'use client';

import { useMemo, useState, useTransition } from 'react';
import { commitImport, type CommitReport } from '@/lib/import-actions';
import { detectFieldMap, ENTITY_FIELDS, parseCsv, planImport, type FieldMap, type ImportEntity, type ImportPlan, type RawRow } from '@/lib/import-engine';

const panel: React.CSSProperties = { background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.18)', borderRadius: 18, padding: 22, boxShadow: '0 18px 60px rgba(2,6,23,.25)' };
const input: React.CSSProperties = { width: '100%', borderRadius: 10, border: '1px solid rgba(148,163,184,.28)', background: 'rgba(15,23,42,.75)', color: '#f8fafc', padding: '10px 12px' };
const button: React.CSSProperties = { border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#8b5cf6,#2563eb)', color: 'white' };

function downloadErrors(plan: ImportPlan) {
  const rows = plan.rows.filter((row) => row.errors.length || row.warnings.length);
  const csv = ['row,action,errors,warnings', ...rows.map((row) => [row.rowNumber, row.action, row.errors.join('; '), row.warnings.join('; ')].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = 'artistos-import-review.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ImportWizard() {
  const [entity, setEntity] = useState<ImportEntity>('fans');
  const [filename, setFilename] = useState('');
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [fieldMap, setFieldMap] = useState<FieldMap>({});
  const [report, setReport] = useState<CommitReport | null>(null);
  const [message, setMessage] = useState('Choose a CSV export to begin. Your file is parsed in the browser before any database write.');
  const [pending, startTransition] = useTransition();
  const headers = useMemo(() => rawRows.length ? Object.keys(rawRows[0]) : [], [rawRows]);
  const plan = useMemo(() => rawRows.length ? planImport({ entity, rawRows, fieldMap }) : null, [entity, rawRows, fieldMap]);
  const requiredMissing = ENTITY_FIELDS[entity].required.filter((field) => !fieldMap[field]);

  async function loadFile(file?: File) {
    setReport(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage('This build accepts CSV directly. Export the first worksheet as CSV for deterministic preview and rollback-safe review.');
      return;
    }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.length) { setMessage('No data rows were found in that file.'); return; }
    setFilename(file.name);
    setRawRows(parsed);
    setFieldMap(detectFieldMap(Object.keys(parsed[0]), entity));
    setMessage(`${parsed.length.toLocaleString()} rows parsed. Review field mapping and the action preview before committing.`);
  }

  function changeEntity(next: ImportEntity) {
    setEntity(next);
    setReport(null);
    if (headers.length) setFieldMap(detectFieldMap(headers, next));
  }

  function runCommit() {
    if (!plan || requiredMissing.length) return;
    startTransition(async () => {
      const result = await commitImport({ entity, rows: plan.rows, filename });
      setReport(result);
      setMessage(result.ok ? 'Import completed successfully.' : 'Import completed with row-level failures. Download the review file and inspect the failures below.');
    });
  }

  return <div style={{ display: 'grid', gap: 18 }}>
    <section style={panel}>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 7, fontWeight: 700 }}>Destination
          <select value={entity} onChange={(event) => changeEntity(event.target.value as ImportEntity)} style={input}>
            <option value="fans">Fans</option><option value="people">People</option><option value="properties">Properties / playlists</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 7, fontWeight: 700 }}>CSV file
          <input type="file" accept=".csv,text/csv" onChange={(event) => loadFile(event.target.files?.[0])} style={input} />
        </label>
      </div>
      <p style={{ margin: '16px 0 0', color: '#94a3b8', lineHeight: 1.6 }}>{message}</p>
    </section>

    {headers.length > 0 && <section style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: 0, fontSize: 20 }}>Field mapping</h2><p style={{ color: '#94a3b8', marginBottom: 0 }}>Auto-detected from {filename}. Change anything that does not look right.</p></div>
        {requiredMissing.length > 0 && <strong style={{ color: '#fbbf24' }}>Map required: {requiredMissing.join(', ')}</strong>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 18 }}>
        {ENTITY_FIELDS[entity].fields.map((field) => <label key={field} style={{ display: 'grid', gap: 6, fontSize: 13, color: '#cbd5e1' }}>{field.replaceAll('_',' ')}{ENTITY_FIELDS[entity].required.includes(field) ? ' *' : ''}
          <select value={fieldMap[field] ?? ''} onChange={(event) => setFieldMap((current) => ({ ...current, [field]: event.target.value }))} style={input}>
            <option value="">Not mapped</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
        </label>)}
      </div>
    </section>}

    {plan && <section style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: 0, fontSize: 20 }}>Import preview</h2><p style={{ color: '#94a3b8', marginBottom: 0 }}>No records have been written. Suppressions are checked again server-side at commit time.</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => downloadErrors(plan)} style={{ ...button, background: 'rgba(51,65,85,.85)' }}>Download review</button>
          <button type="button" disabled={pending || requiredMissing.length > 0} onClick={runCommit} style={{ ...button, opacity: pending || requiredMissing.length ? .5 : 1 }}>{pending ? 'Importing…' : `Commit ${plan.counts.create + plan.counts.update} rows`}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(125px,1fr))', gap: 10, margin: '18px 0' }}>
        {Object.entries(plan.counts).map(([key,value]) => <div key={key} style={{ padding: 14, borderRadius: 12, background: 'rgba(30,41,59,.65)' }}><div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div><div style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{key}</div></div>)}
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(148,163,184,.15)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}><thead><tr style={{ background: 'rgba(30,41,59,.9)', textAlign: 'left' }}><th style={{ padding: 12 }}>Row</th><th>Action</th><th>Key</th><th>Review</th></tr></thead>
          <tbody>{plan.rows.slice(0, 100).map((row) => <tr key={row.rowNumber} style={{ borderTop: '1px solid rgba(148,163,184,.12)' }}><td style={{ padding: 12 }}>{row.rowNumber}</td><td style={{ fontWeight: 700 }}>{row.action}</td><td>{row.key ?? '—'}</td><td style={{ color: row.errors.length ? '#fca5a5' : '#94a3b8' }}>{[...row.errors,...row.warnings].join(' ') || 'Ready'}</td></tr>)}</tbody>
        </table>
      </div>
      {plan.rows.length > 100 && <p style={{ color: '#94a3b8' }}>Showing the first 100 of {plan.rows.length.toLocaleString()} rows.</p>}
    </section>}

    {report && <section style={{ ...panel, borderColor: report.ok ? 'rgba(34,197,94,.35)' : 'rgba(245,158,11,.4)' }}>
      <h2 style={{ marginTop: 0 }}>Import result</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
        {(['created','updated','skipped','suppressed','invalid','failed'] as const).map((key) => <div key={key} style={{ background: 'rgba(30,41,59,.65)', padding: 14, borderRadius: 12 }}><strong style={{ fontSize: 24 }}>{report[key]}</strong><div style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{key}</div></div>)}
      </div>
      {report.errors.length > 0 && <div style={{ marginTop: 16, maxHeight: 240, overflow: 'auto' }}>{report.errors.map((error) => <p key={`${error.rowNumber}-${error.message}`} style={{ color: '#fca5a5' }}>Row {error.rowNumber}: {error.message}</p>)}</div>}
    </section>}
  </div>;
}
