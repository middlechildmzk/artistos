import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/oauth';
import { createClient } from '@/lib/supabase/server';

function encodeBase64Url(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function headerSafe(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as Record<string, unknown>;
    const to = String(input.to ?? '').trim().toLowerCase();
    const subject = headerSafe(String(input.subject ?? ''));
    const body = String(input.body ?? '').trim();
    const propertyId = String(input.property_id ?? '') || null;
    const personId = String(input.person_id ?? '') || null;
    const followUpDue = String(input.follow_up_due ?? '') || null;
    if (!to || !/^\S+@\S+\.\S+$/.test(to)) return NextResponse.json({ error: 'A valid recipient email is required.' }, { status: 400 });
    if (!subject || !body) return NextResponse.json({ error: 'Subject and body are required.' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: suppression, error: suppressionError } = await supabase.from('suppressions').select('id,reason').ilike('email', to).limit(1).maybeSingle();
    if (suppressionError) throw new Error(`Suppression check failed: ${suppressionError.message}`);
    if (suppression) return NextResponse.json({ error: `Recipient is suppressed${suppression.reason ? `: ${suppression.reason}` : ''}. Draft creation was blocked.` }, { status: 409 });

    const accessToken = await getValidAccessToken('google');
    const raw = encodeBase64Url([
      `To: ${headerSafe(to)}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
    ].join('\r\n'));
    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { raw } }),
      cache: 'no-store',
    });
    const gmail = await gmailResponse.json();
    if (!gmailResponse.ok) throw new Error(gmail.error?.message || 'Gmail did not create the draft.');

    const { data: campaigns } = await supabase.from('campaigns').select('id').eq('status', 'active').limit(1);
    const { data: interaction, error: logError } = await supabase.from('interactions').insert({
      campaign_id: campaigns?.[0]?.id ?? null,
      property_id: propertyId,
      person_id: personId,
      direction: 'outbound',
      channel: 'gmail_draft',
      subject,
      body,
      follow_up_due: followUpDue,
      notes: `Gmail draft ${gmail.id} created after an exact suppression check. No email was sent.`,
    }).select('id').single();
    if (logError) throw new Error(`Draft exists in Gmail, but ArtistOS logging failed: ${logError.message}`);
    return NextResponse.json({ draftId: gmail.id, messageId: gmail.message?.id ?? null, interactionId: interaction.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gmail draft failed.' }, { status: 500 });
  }
}
