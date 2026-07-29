import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AutonomyPolicy } from "@/lib/policies/evaluate";
import { getCapabilityHandler } from "./handlers";
import type { InvocationDependencies } from "./invoke";
import type { ActorContext } from "./types";
import "./public-links-registry";
import "./public-links-handlers";

export function createPublicLinkActorContext(link: { id: string; workspaceId: string }): ActorContext {
  return {
    principalId: `public-link:${link.id}`,
    userId: null,
    workspaceId: link.workspaceId,
    artistId: null,
    role: "viewer",
  };
}

export function createPublicLinkInvocationDependencies(link: { id: string; workspaceId: string }): InvocationDependencies {
  return {
    async authorize(ctx, capabilityName, input) {
      const inputLinkId = typeof input === "object" && input !== null && "linkId" in input ? String(input.linkId) : "";
      const allowed = capabilityName === "public_links.capture_fan"
        && ctx.principalId === `public-link:${link.id}`
        && ctx.workspaceId === link.workspaceId
        && inputLinkId === link.id;
      return allowed
        ? { allowed: true }
        : { allowed: false, reason: "Public link principal does not match the requested link", policy: "authorization.public_link_scope" };
    },
    async loadPolicies(ctx, capabilityName) {
      const policy: AutonomyPolicy = {
        id: "public_links.explicit_fan_consent",
        effect: "allow",
        capabilityName,
        actorPrincipalId: ctx.principalId,
        workspaceId: ctx.workspaceId,
        level: "L2",
        reason: "The visitor explicitly submitted both required consent choices on this active public link",
      };
      return [policy];
    },
    async createApproval() {
      throw new Error("public_link_capability_must_not_request_approval");
    },
    async execute<O>(args) {
      const handler = getCapabilityHandler(args.capabilityName, args.version);
      const execution = await handler({ ctx: args.ctx, input: args.input, idempotencyKey: args.idempotencyKey });
      return { output: execution.output as O, evidenceIds: execution.evidenceIds, auditId: execution.auditId };
    },
    async hashPreview(input) {
      return createHash("sha256").update(JSON.stringify(input)).digest("hex");
    },
    async recordAudit(args) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("capability_audit_log")
        .insert({
          workspace_id: args.ctx.workspaceId,
          artist_id: null,
          principal_id: args.ctx.principalId,
          user_id: null,
          capability_name: args.capabilityName,
          capability_version: args.version,
          risk_class: args.riskClass,
          decision: args.decision,
          policy_id: args.policyId ?? null,
          idempotency_key: args.idempotencyKey ?? null,
          input_hash: args.inputHash ?? null,
          output_summary: args.outputSummary ?? null,
          evidence_ids: args.evidenceIds ?? [],
          error_code: args.errorCode ?? null,
          error_message: args.errorMessage ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
  };
}
