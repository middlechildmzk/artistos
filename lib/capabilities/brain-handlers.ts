import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import { createBrainMemoryCapability, reviewBrainClaimCapability } from "./brain-registry";

async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("capability_idempotency").select("result").eq("workspace_id", workspaceId).eq("capability_name", capabilityName).eq("idempotency_key", key).maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: { workspaceId: string; capabilityName: string; capabilityVersion: number; key: string; result: unknown; userId?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({ workspace_id: args.workspaceId, capability_name: args.capabilityName, capability_version: args.capabilityVersion, idempotency_key: args.key, input_hash: args.key, result: args.result, created_by: args.userId ?? null });
  if (error) throw error;
}

registerCapabilityHandler(createBrainMemoryCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const evidenceIds = input.evidenceIds ?? [];
  const replay = await readReplay(ctx.workspaceId, createBrainMemoryCapability.name, key);
  if (replay && typeof replay === "object" && "memoryId" in replay) return { output: replay as any, evidenceIds };
  const supabase = await createSupabaseServerClient();
  if (input.artistId) {
    const { data: artist, error } = await supabase.from("artists").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.artistId).maybeSingle();
    if (error) throw error;
    if (!artist) throw new Error("artist_not_found");
  }
  if (evidenceIds.length) {
    const { data, error } = await supabase.from("evidence_records").select("id").eq("workspace_id", ctx.workspaceId).in("id", evidenceIds);
    if (error) throw error;
    if ((data ?? []).length !== evidenceIds.length) throw new Error("evidence_not_found");
  }
  const { data: memory, error: memoryError } = await supabase.from("brain_memories").insert({ workspace_id: ctx.workspaceId, artist_id: input.artistId ?? null, memory_class: input.memoryClass, namespace: input.namespace, title: input.title, summary: input.summary ?? null, content: input.content, source_kind: input.sourceKind, confidence: input.confidence, observed_at: input.observedAt ?? null, created_by: ctx.userId }).select("id").single();
  if (memoryError) throw memoryError;
  const { data: claim, error: claimError } = await supabase.from("brain_claims").insert({ workspace_id: ctx.workspaceId, artist_id: input.artistId ?? null, memory_id: memory.id, claim_type: input.memoryClass, predicate: input.namespace, object_value: input.content, confidence: input.confidence, review_status: input.sourceKind === "human" ? "accepted" : "pending", reviewer_id: input.sourceKind === "human" ? ctx.userId : null, reviewed_at: input.sourceKind === "human" ? new Date().toISOString() : null, created_by: ctx.userId }).select("id").single();
  if (claimError) throw claimError;
  if (evidenceIds.length) {
    const { error } = await supabase.from("brain_claim_evidence").insert(evidenceIds.map((evidenceId) => ({ claim_id: claim.id, evidence_id: evidenceId, relationship: "supports" })));
    if (error) throw error;
  }
  const result = { memoryId: memory.id, claimId: claim.id, created: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createBrainMemoryCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds };
});

registerCapabilityHandler(reviewBrainClaimCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, reviewBrainClaimCapability.name, key);
  if (replay && typeof replay === "object" && "claimId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: claim, error } = await supabase.from("brain_claims").select("id,review_status").eq("workspace_id", ctx.workspaceId).eq("id", input.claimId).maybeSingle();
  if (error) throw error;
  if (!claim) throw new Error("claim_not_found");
  const changed = claim.review_status !== input.reviewStatus;
  if (changed) {
    const { error: updateError } = await supabase.from("brain_claims").update({ review_status: input.reviewStatus, reviewer_id: ctx.userId, reviewed_at: new Date().toISOString(), review_note: input.reviewNote ?? null }).eq("workspace_id", ctx.workspaceId).eq("id", input.claimId);
    if (updateError) throw updateError;
  }
  const result = { claimId: input.claimId, reviewStatus: input.reviewStatus, changed };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: reviewBrainClaimCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});