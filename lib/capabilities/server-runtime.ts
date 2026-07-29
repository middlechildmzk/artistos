import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCapability } from "./registry";
import { getCapabilityHandler } from "./handlers";
import type { ActorContext, WorkspaceRole } from "./types";
import type { InvocationDependencies } from "./invoke";
import type { AutonomyPolicy } from "@/lib/policies/evaluate";

import "./initial-registry";
import "./campaign-registry";
import "./crm-release-registry";
import "./brain-registry";
import "./planner-registry";
import "./execution-registry";
import "./operating-registry";
import "./links-registry";
import "./core-handlers";
import "./campaign-handlers";
import "./crm-release-handlers";
import "./brain-handlers";
import "./planner-handlers";
import "./execution-handlers";
import "./operating-handlers";
import "./links-handlers";

const ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 0, contributor: 1, editor: 2, admin: 3, owner: 4 };

export function createServerInvocationDependencies(): InvocationDependencies {
  return {
    async authorize(ctx, capabilityName) {
      const capability = getCapability(capabilityName);
      if (ROLE_RANK[ctx.role] < ROLE_RANK[capability.scope.minRole]) return { allowed: false, reason: `${capability.scope.minRole} role required`, policy: "authorization.workspace_role" };
      if (capability.scope.resource === "artist" && !ctx.artistId) return { allowed: false, reason: "Artist scope is required", policy: "authorization.artist_scope" };
      return { allowed: true };
    },
    async loadPolicies(ctx, capabilityName) {
      // Agent principals receive no implicit grant and default to approval.
      if (ctx.userId && ctx.principalId === `user:${ctx.userId}`) {
        const policy: AutonomyPolicy = { id: "system.explicit_human_action", effect: "allow", capabilityName, actorPrincipalId: ctx.principalId, workspaceId: ctx.workspaceId, level: "L3", reason: "The authenticated human explicitly initiated this reversible action" };
        return [policy];
      }
      return [];
    },
    async createApproval({ ctx, capabilityName, version, input, previewHash }) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.from("capability_approvals").insert({ workspace_id: ctx.workspaceId, artist_id: ctx.artistId, capability_name: capabilityName, capability_version: version, requested_by: ctx.userId, request_payload: input, preview: input, preview_hash: previewHash, status: "pending" }).select("id").single();
      if (error) throw error;
      return { approvalId: data.id, preview: input };
    },
    async execute<O>(args: { ctx: ActorContext; capabilityName: string; version: number; input: unknown; idempotencyKey?: string }) {
      const handler = getCapabilityHandler(args.capabilityName, args.version);
      const execution = await handler({ ctx: args.ctx, input: args.input, idempotencyKey: args.idempotencyKey });
      return { output: execution.output as O, evidenceIds: execution.evidenceIds, auditId: execution.auditId };
    },
    async hashPreview(input) { return createHash("sha256").update(JSON.stringify(input)).digest("hex"); },
    async recordAudit(args) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.from("capability_audit_log").insert({ workspace_id: args.ctx.workspaceId, artist_id: args.ctx.artistId, principal_id: args.ctx.principalId, user_id: args.ctx.userId, capability_name: args.capabilityName, capability_version: args.version, risk_class: args.riskClass, decision: args.decision, policy_id: args.policyId ?? null, idempotency_key: args.idempotencyKey ?? null, input_hash: args.inputHash ?? null, output_summary: args.outputSummary ?? null, evidence_ids: args.evidenceIds ?? [], error_code: args.errorCode ?? null, error_message: args.errorMessage ?? null, run_id: args.ctx.runId ?? null, step_id: args.ctx.stepId ?? null }).select("id").single();
      if (error) throw error;
      return data.id;
    },
  };
}

export async function createActorContext(): Promise<ActorContext> {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("not_authenticated");
  const { data: membership, error: membershipError } = await supabase.from("workspace_members").select("workspace_id,role").eq("user_id", auth.user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error("workspace_not_found");
  return { principalId: `user:${auth.user.id}`, userId: auth.user.id, workspaceId: membership.workspace_id, artistId: null, role: membership.role as WorkspaceRole };
}
