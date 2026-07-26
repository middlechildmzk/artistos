import { createClient } from '@/lib/supabase/server';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'contributor' | 'viewer';
export type ActiveWorkspace = { workspaceId: string; role: WorkspaceRole; userId: string };

const RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  contributor: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export async function getActiveWorkspace(): Promise<ActiveWorkspace> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required.');

  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id,role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not resolve workspace: ${error.message}`);
  if (!data) throw new Error('No workspace membership. Ask an owner to add you.');

  return {
    workspaceId: data.workspace_id as string,
    role: data.role as WorkspaceRole,
    userId: user.id,
  };
}

export function hasRole(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return RANK[role] >= RANK[minimum];
}

export async function requireRole(minimum: WorkspaceRole): Promise<ActiveWorkspace> {
  const workspace = await getActiveWorkspace();
  if (!hasRole(workspace.role, minimum)) {
    throw new Error(`This action requires ${minimum} access. Your role is ${workspace.role}.`);
  }
  return workspace;
}
