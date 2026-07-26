'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/workspace';
import { chunkRows, type ImportEntity, type PlannedRow } from '@/lib/import-engine';

export type CommitReport = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  suppressed: number;
  invalid: number;
  failed: number;
  errors: Array<{ rowNumber: number; message: string }>;
};

const emptyReport = (): CommitReport => ({ ok: true, created: 0, updated: 0, skipped: 0, suppressed: 0, invalid: 0, failed: 0, errors: [] });

function safeData(row: PlannedRow, workspaceId: string): Record<string, unknown> {
  return { ...row.data, workspace_id: workspaceId, updated_at: new Date().toISOString() };
}

export async function commitImport(input: { entity: ImportEntity; rows: PlannedRow[]; filename?: string }): Promise<CommitReport> {
  const workspace = await requireRole('editor');
  const supabase = await createClient();
  const report = emptyReport();
  const rows = input.rows.slice(0, 50_000);

  for (const row of rows) {
    if (row.action === 'invalid') report.invalid += 1;
    else if (row.action === 'suppressed') report.suppressed += 1;
    else if (row.action === 'skip') report.skipped += 1;
  }

  const actionable = rows.filter((row) => row.action === 'create' || row.action === 'update');
  for (const chunk of chunkRows(actionable, 100)) {
    for (const row of chunk) {
      try {
        const data = safeData(row, workspace.workspaceId);
        if (input.entity === 'fans') {
          const email = String(data['normalized_email'] ?? '');
          const suppressionRead = await supabase.from('suppressions').select('id').eq('workspace_id', workspace.workspaceId).eq('normalized_email', email).maybeSingle();
          if (suppressionRead.error) throw suppressionRead.error;
          if (suppressionRead.data) { report.suppressed += 1; continue; }
          const existingRead = await supabase.from('fans').select('id').eq('workspace_id', workspace.workspaceId).eq('normalized_email', email).maybeSingle();
          if (existingRead.error) throw existingRead.error;
          if (existingRead.data) {
            const { error } = await supabase.from('fans').update(data).eq('workspace_id', workspace.workspaceId).eq('id', existingRead.data.id);
            if (error) throw error;
            report.updated += 1;
          } else {
            const { error } = await supabase.from('fans').insert(data);
            if (error) throw error;
            report.created += 1;
          }
        } else if (input.entity === 'people') {
          const email = typeof data['normalized_email'] === 'string' ? data['normalized_email'] : null;
          let existing: { id: string } | null = null;
          if (email) {
            const result = await supabase.from('people').select('id').eq('workspace_id', workspace.workspaceId).eq('normalized_email', email).maybeSingle();
            if (result.error) throw result.error;
            existing = result.data as { id: string } | null;
          }
          if (existing) {
            const { error } = await supabase.from('people').update(data).eq('workspace_id', workspace.workspaceId).eq('id', existing.id);
            if (error) throw error;
            report.updated += 1;
          } else {
            const { error } = await supabase.from('people').insert(data);
            if (error) throw error;
            report.created += 1;
          }
        } else {
          const url = typeof data['url'] === 'string' ? data['url'] : null;
          let query = supabase.from('properties').select('id').eq('workspace_id', workspace.workspaceId);
          query = url ? query.eq('url', url) : query.eq('name', String(data['name'] ?? ''));
          const result = await query.limit(1).maybeSingle();
          if (result.error) throw result.error;
          if (result.data) {
            const { error } = await supabase.from('properties').update(data).eq('workspace_id', workspace.workspaceId).eq('id', result.data.id);
            if (error) throw error;
            report.updated += 1;
          } else {
            const { error } = await supabase.from('properties').insert(data);
            if (error) throw error;
            report.created += 1;
          }
        }
      } catch (error) {
        report.ok = false;
        report.failed += 1;
        report.errors.push({ rowNumber: row.rowNumber, message: error instanceof Error ? error.message : 'Unknown import error' });
      }
    }
  }

  revalidatePath('/fans');
  revalidatePath('/industry');
  revalidatePath('/properties');
  revalidatePath('/data-import');
  return report;
}
