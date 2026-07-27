import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkspaceContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: User;
  workspaceId: string;
  role: string;
};

/**
 * Resolve the authenticated user's active workspace deterministically.
 *
 * ArtistOS currently supports one implicit active workspace. Until an explicit
 * workspace selector is introduced, the oldest membership is selected so the
 * same user cannot drift between workspaces across requests.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    throw new Error("Not authenticated");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) throw new Error("No workspace membership found");

  return {
    supabase,
    user: auth.user,
    workspaceId: membership.workspace_id,
    role: membership.role,
  };
}
