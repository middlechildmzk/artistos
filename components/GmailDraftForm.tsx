"use client";

import { useState, type ChangeEvent, type FormEvent } from 'react';

type Target = { id: string; name?: string; full_name?: string; email?: string; contact_emails?: string; platform?: string; role?: string };
type DraftState = { draftId: string; interactionId: string; messageId?: string | null } | null;

export function GmailDraftForm({ properties, people }: { properties: Target[]; people: Target[] }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftState>(null);
  const [confirmation, setConfirmation] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setDraft(null); setStatus('Checking the authoritative suppression list and Gmail connection…');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/gmail/draft', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(Object.fromEntries(form.entries())) });
    const result = await response.json().catch(() => ({ error:'Unexpected response.' }));
    if (response.ok) { setDraft(result); setStatus(`Draft created in Gmail: ${result.draftId}. It has not been sent.`); }
    else setStatus(result.error || 'Draft could not be created.');
    setBusy(false);
  }
  async function send() {
    if (!draft) return;
    setBusy(true); setStatus('Rechecking recipients against suppressions before sending…');
    const response = await fetch('/api/gmail/send', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ draftId:draft.draftId, interactionId:draft.interactionId, confirmation }) });
    const result = await response.json().catch(() => ({ error:'Unexpected response.' }));
    if (response.ok) { setStatus(`Sent after explicit confirmation. Gmail message: ${result.messageId}`); setDraft(null); setConfirmation(''); }
    else setStatus(result.error || 'Draft was not sent.');
    setBusy(false);
  }
  return <div className="stack">
    <form className="stack" onSubmit={submit}>
      <div className="field"><label>Recipient</label><input className="input" name="to" type="email" required placeholder="verified@example.com" /></div>
      <div className="field"><label>Linked property</label><select className="select" name="property_id"><option value="">None</option>{properties.map((row) => <option value={row.id} key={row.id}>{row.name} · {row.platform || 'platform unknown'}</option>)}</select></div>
      <div className="field"><label>Linked person</label><select className="select" name="person_id"><option value="">None</option>{people.map((row) => <option value={row.id} key={row.id}>{row.full_name || row.email} · {row.role || 'role unknown'}</option>)}</select></div>
      <div className="field"><label>Subject</label><input className="input" name="subject" required defaultValue="Middle Child — Never Alone (July 31)" /></div>
      <div className="field"><label>Body</label><textarea className="textarea" name="body" required defaultValue={'Hi,\n\nI’m reaching out with “Never Alone,” a new emotional electronic / melodic bass release from Middle Child, arriving July 31. I thought it may fit because [add only a verified, specific reason].\n\nListen / pre-save: [verified link]\n\nThank you for listening,\nDan / Middle Child'} /></div>
      <div className="field"><label>Follow-up due</label><input className="input" name="follow_up_due" type="date" /></div>
      <button className="button primary" type="submit" disabled={busy}>{busy ? 'Working…' : 'Create Gmail draft'}</button>
    </form>
    {draft ? <div className="card inset stack"><strong>Review in Gmail before sending</strong><p className="muted">ArtistOS never auto-sends. After reviewing the saved Gmail draft, type <code>SEND</code> exactly. The server will fetch the draft, re-read every recipient, and check suppressions again.</p><input className="input" value={confirmation} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmation(event.target.value)} placeholder="Type SEND" /><button className="button danger" type="button" onClick={send} disabled={busy || confirmation !== 'SEND'}>Send reviewed Gmail draft</button></div> : null}
    {status ? <div className={status.startsWith('Draft created') || status.startsWith('Sent') ? 'notice' : 'notice warning'}>{status}</div> : null}
  </div>;
}
