import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCapability } from "./registry";
import { getCapabilityHandler } from "./handlers";
import type { ActorContext, WorkspaceRole } from "./types";
import type { InvocationDependencies } from "./invoke";
import type { AutonomyPolicy } from "@/lib/policies/evaluate";

import "./initial-registry";
import "./core-handlers";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  contributor: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export function createServerInvocationDependencies(): InvocationDependencies {
  return {
    async authorize(ctx, capabilityName) {
      const capability = getCapability(capabilityName);
      if (ROLE_RANK[ctx.role] < ROLE_RANK[capability.scope.minRole]) {
        return {
          allowed: false,
          reason: `${capability.scope.minRole} role required`,
          policy: "authorization.workspace_role",
        };
      }
      if (capability.scope.resource === "artist" && !ctx.artistId) {
        return {
          allowed: false,
          reason: "Artist scope is required",
          policy: "authorization.artist_scope",
        };
      }
      return { allowed: true };
    },

    async loadPolicies(ctx, capabilityName) {
      // Explicit human interaction is not autonomous execution. A signed-in
      // human with sufficient workspace role may perform reversible R1 work.
      // Agent principals receive no implicit grant and default to approval.
      if (ctx.userId && ctx.principalId === `user:${ctx.userId}`) {
        const policy: AutonomyPolicy = {
          id: "system.explicit_human_action",
          effect: "allow",
          capabilityName,
          actorPrincipalId: ctx.principalId,
          workspaceId: ctx.workspaceId,
          level: "L3",
          reason: "The authenticated human explicitly initiated this reversible action",
        };
        return [policy];
      }
      return [];
    },

    async createApproval({ ctx, capabilityName, version, input, previewHash }) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("capability_approvals")
        .insert({
          workspace_id: ctx.workspaceId,
          artist_id: ctx.artistId,
          capability_name: capabilityName,
          capability_version: version,
          requested_by: ctx.userId,
          request_payload: input,
          preview: input,
          preview_hash: previewHash,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      return { approvalId: data.id, preview: input };
    },

    async execute({ ctx, capabilityName, version, input, idempotencyKey }) {
      const handler = getCapabilityHandler(capabilityName, version);
      return handler({ ctx, input, idempotencyKey });
    },

    async hashPreview(input) {
      return createHash("sha256").update(JSON.stringify(input)).digest("hex");
    },
  };
}

export async function createActorContext(): Promise<ActorContext> {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("not_authenticated");

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error("workspace_not_found");

  return {
    principalId: `user:${auth.user.id}`,
    userId: auth.user.id,
    workspaceId: membership.workspace_id,
    artistId: null,
    role: membership.role as WorkspaceRole,
  };
}
