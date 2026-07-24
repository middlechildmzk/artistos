import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/oauth';
import { createClient } from '@/lib/supabase/server';

function recipientEmails(headers: Array<{ name?: string; value?: string }>) {
  const values = headers.filter((header) => /^(to|cc|bcc)$/i.test(header.name || '')).map((header) => header.value || '').join(',');
  return [...new Set((values.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((email) => email.toLowerCase()))];
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as { draftId?: string; confirmation?: string; interactionId?: string };
    if (!input.draftId) return NextResponse.json({ error: 'Draft ID is required.' }, { status: 400 });
    if (input.confirmation !== 'SEND') return NextResponse.json({ error: 'Explicit confirmation is required. Enter SEND exactly.' }, { status: 409 });
    const accessToken = await getValidAccessToken('google');
    const draftResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(input.draftId)}?format=metadata&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc`, { headers: { authorization: `Bearer ${accessToken}` }, cache:'no-store' });
    const draft = await draftResponse.json();
    if (!draftResponse.ok) throw new Error(draft.error?.message || 'Gmail draft could not be re-read.');
    const recipients = recipientEmails(draft.message?.payload?.headers || []);
    if (!recipients.length) return NextResponse.json({ error: 'No recipient could be verified in the Gmail draft.' }, { status: 409 });

    const supabase = await createClient();
    const { data: suppressed, error: suppressionError } = await supabase.from('suppressions').select('email,reason').in('email', recipients);
    if (suppressionError) throw new Error(`Final suppression check failed: ${suppressionError.message}`);
    if (suppressed?.length) return NextResponse.json({ error: `Send blocked. Suppressed recipient detected: ${suppressed.map((row: { email: string }) => row.email).join(', ')}` }, { status: 409 });

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id: input.draftId }),
      cache: 'no-store',
    });
    const sent = await response.json();
    if (!response.ok) throw new Error(sent.error?.message || 'Gmail did not send the draft.');
    if (input.interactionId) {
      const { error } = await supabase.from('interactions').update({ channel: 'gmail_sent', occurred_at: new Date().toISOString(), notes: `Explicitly confirmed send after final suppression check. Gmail message ${sent.id}; thread ${sent.threadId || 'unknown'}.` }).eq('id', input.interactionId);
      if (error) throw new Error(`Email sent, but ArtistOS logging failed: ${error.message}`);
    }
    return NextResponse.json({ messageId: sent.id, threadId: sent.threadId ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gmail send failed.' }, { status: 500 });
  }
}
