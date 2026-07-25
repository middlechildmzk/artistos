import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function extractText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  return (payload?.output ?? []).flatMap((item: any) => item?.content ?? []).filter((item: any) => item?.type === 'output_text').map((item: any) => item.text).join('\n');
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI provider is not configured.' }, { status: 503 });
  try {
    const input = await request.json() as { mode?: string; prompt?: string; targetKind?: string; targetId?: string };
    const allowedModes = new Set(['pitch','followup','strategist','campaign','focus']);
    const mode = allowedModes.has(String(input.mode)) ? String(input.mode) : 'focus';
    const prompt = String(input.prompt ?? '').trim().slice(0, 5000);
    if (!prompt) return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    const [{ data: release }, { data: tasks }] = await Promise.all([
      supabase.from('releases').select('id,title,featured_artist,release_date,distributor,label,upc,status,notes').eq('title', 'Never Alone').maybeSingle(),
      supabase.from('tasks').select('id,title,detail,status,due_date,blocked_by,blocker_cleared,classification').order('due_date').limit(25),
    ]);
    const facts = { release, tasks: tasks ?? [], guardrails: ['Do not invent contacts, emails, history, performance, placement, rights, or guarantees.', 'Use only supplied database facts.', 'Drafts require user review and never trigger sending.'] };
    const model = process.env.OPENAI_MODEL || 'gpt-5';
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, store: false, input: [{ role:'system', content:'You are the audited ArtistOS copilot. Be practical, concise, and strictly grounded in the supplied facts and guardrails.' }, { role:'user', content:`FACTS:\n${JSON.stringify(facts)}\n\nREQUEST:\n${prompt}` }] }),
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'AI generation failed.');
    const output = extractText(result);
    const { data: generation, error: auditError } = await supabase.from('ai_generations').insert({
      created_by: user.id, mode, prompt_version:'artistos-v2', provider:'openai', model, live_ai:true,
      target_kind: input.targetKind || null, target_id: input.targetId || null,
      context_ref: { release_id: release?.id ?? null, task_ids: (tasks ?? []).map((task: { id: string }) => task.id) },
      input_prompt: prompt, output_text: output, approval_state:'draft', usage: result.usage ?? null,
    }).select('id').single();
    if (auditError) throw new Error(`Generation succeeded, but audit logging failed: ${auditError.message}`);
    return NextResponse.json({ id: generation.id, output, model, approvalState: 'draft' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'AI generation failed.' }, { status: 500 });
  }
}
