'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace, requireRole } from '@/lib/workspace';
import { normalizeEmail } from '@/lib/normalize';

export const SUPPRESSION_REASONS = [
  'unsubscribe', 'manual', 'bounce', 'complaint', 'role_address', 'invalid', 'import', 'other',
] as const;

export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];
export type SuppressionResult = {
  ok: boolean;
  email?: string;
  alreadySuppressed?: boolean;
  message: string;
};

function parseReason(raw: FormDataEntryValue | null): SuppressionReason {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return (SUPPRESSION_REASONS as readonly string[]).includes(value)
    ? value as SuppressionReason
    : 'manual';
}

export async function suppressEmail(formData: FormData): Promise<SuppressionResult> {
  const workspace = await requireRole('contributor');
  const supabase = await createClient();
  const parsed = normalizeEmail(formData.get('email'));
  if (!parsed.value) return { ok: false, message: 'Enter an email address to suppress.' };

  const email = parsed.value;
  const reason = parsed.valid ? parseReason(formData.get('reason')) : 'invalid';
  const notesValue = formData.get('notes');
  const sourceValue = formData.get('source');
  const notes = typeof notesValue === 'string' ? notesValue.trim() || null : null;
  const source = typeof sourceValue === 'string' ? sourceValue.trim() || 'artistos' : 'artistos';

  const { data: existing, error: readError } = await supabase
    .from('suppressions')
    .select('id,suppressed_at')
    .eq('workspace_id', workspace.workspaceId)
    .eq('normalized_email', email)
    .maybeSingle();
  if (readError) return { ok: false, message: `Could not check suppression status: ${readError.message}` };
  if (existing) {
    return {
      ok: true,
      email,
      alreadySuppressed: true,
      message: `${email} was already suppressed${existing.suppressed_at ? ` on ${existing.suppressed_at}` : ''}.`,
    };
  }

  const { error } = await supabase.from('suppressions').insert({
    workspace_id: workspace.workspaceId,
    email,
    normalized_email: email,
    reason: notes ? `${reason}: ${notes}` : reason,
    reason_code: reason,
    notes,
    source,
    suppressed_by: workspace.userId,
    suppressed_at: new Date().toISOString().slice(0, 10),
  });

  if (error?.code === '23505') {
    return { ok: true, email, alreadySuppressed: true, message: `${email} is suppressed.` };
  }
  if (error) return { ok: false, message: `Could not suppress ${email}: ${error.message}` };

  revalidatePath('/fans');
  revalidatePath('/');
  return { ok: true, email, message: `${email} suppressed and removed from contactable audiences.` };
}

export type BulkSuppressionResult = {
  ok: boolean;
  suppressed: number;
  alreadySuppressed: number;
  invalid: number;
  failed: number;
  errors: string[];
};

export async function suppressBulk(
  emails: string[],
  reason: SuppressionReason = 'manual',
  source = 'artistos-bulk',
): Promise<BulkSuppressionResult> {
  const workspace = await requireRole('editor');
  const supabase = await createClient();
  const result: BulkSuppressionResult = {
    ok: true,
    suppressed: 0,
    alreadySuppressed: 0,
    invalid: 0,
    failed: 0,
    errors: [],
  };

  const normalized = new Map<string, boolean>();
  for (const raw of emails) {
    const parsed = normalizeEmail(raw);
    if (!parsed.value) {
      result.invalid += 1;
      continue;
    }
    if (!parsed.valid) result.invalid += 1;
    normalized.set(parsed.value, parsed.valid);
  }
  if (!normalized.size) return result;

  const addresses = [...normalized.keys()];
  const { data: existingRows, error: existingError } = await supabase
    .from('suppressions')
    .select('normalized_email')
    .eq('workspace_id', workspace.workspaceId)
    .in('normalized_email', addresses);
  if (existingError) {
    return { ...result, ok: false, failed: addresses.length, errors: [existingError.message] };
  }

  const existing = new Set((existingRows ?? []).map((row) => row.normalized_email as string));
  const today = new Date().toISOString().slice(0, 10);
  const rows = addresses.filter((email) => !existing.has(email)).map((email) => {
    const rowReason = normalized.get(email) ? reason : 'invalid';
    return {
      workspace_id: workspace.workspaceId,
      email,
      normalized_email: email,
      reason: rowReason,
      reason_code: rowReason,
      source,
      suppressed_by: workspace.userId,
      suppressed_at: today,
    };
  });
  result.alreadySuppressed = addresses.length - rows.length;

  for (let index = 0; index < rows.length; index += 250) {
    const chunk = rows.slice(index, index + 250);
    const { error } = await supabase.from('suppressions').insert(chunk);
    if (error) {
      result.failed += chunk.length;
      result.ok = false;
      result.errors.push(error.message);
    } else {
      result.suppressed += chunk.length;
    }
  }

  revalidatePath('/fans');
  return result;
}

export async function checkSuppressed(emails: string[]): Promise<Set<string>> {
  const workspace = await getActiveWorkspace();
  const supabase = await createClient();
  const normalized = [...new Set(emails
    .map((email) => normalizeEmail(email).value)
    .filter((email): email is string => Boolean(email)))];
  const found = new Set<string>();

  for (let index = 0; index < normalized.length; index += 500) {
    const { data, error } = await supabase
      .from('suppressions')
      .select('normalized_email')
      .eq('workspace_id', workspace.workspaceId)
      .in('normalized_email', normalized.slice(index, index + 500));
    if (error) throw new Error(`Could not check suppression list: ${error.message}`);
    for (const row of data ?? []) found.add(row.normalized_email as string);
  }
  return found;
}
