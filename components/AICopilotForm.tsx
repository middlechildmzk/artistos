"use client";

import { useState, type FormEvent } from 'react';

export function AICopilotForm() {
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus('Building a grounded draft from live release facts…'); setOutput('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/ai', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(Object.fromEntries(form.entries())) });
    const result = await response.json().catch(() => ({ error:'Unexpected response.' }));
    if (response.ok) { setOutput(result.output || 'No text returned.'); setStatus(`Audited draft ${result.id} · ${result.model}`); }
    else setStatus(result.error || 'Generation failed.');
    setBusy(false);
  }
  return <form className="stack" onSubmit={submit}>
    <div className="field"><label htmlFor="ai-mode">Mode</label><select className="select" id="ai-mode" name="mode" defaultValue="focus"><option value="focus">Focus today</option><option value="pitch">Outreach pitch</option><option value="followup">Follow-up</option><option value="campaign">Campaign copy</option><option value="strategist">Strategy</option></select></div>
    <div className="field"><label htmlFor="ai-prompt">Request</label><textarea className="textarea" id="ai-prompt" name="prompt" required defaultValue="Summarize the highest-priority work for today, explain why it comes first, and identify any blocker that should stop outreach." /></div>
    <button className="button primary" type="submit" disabled={busy}>{busy ? 'Generating…' : 'Generate grounded draft'}</button>
    {status ? <div className={output ? 'notice' : 'notice warning'}>{status}</div> : null}
    {output ? <pre className="ai-output">{output}</pre> : null}
  </form>;
}
