import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import {
  createAutomationPlanCapability,
  createContentIdeaCapability,
  createRecommendationCapability,
  recordMetricSnapshotCapability,
} from "./planner-registry";

async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("capability_idempotency").select("result").eq("workspace_id", workspaceId).eq("capability_name", capabilityName).eq("idempotency_key", key).maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: { workspaceId: string; capabilityName: string; capabilityVersion: number; key: string; result: unknown; userId?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: args.capabilityName,
    capability_version: args.capabilityVersion,
    idempotency_key: args.key,
    input_hash: args.key,
    result: args.result,
    created_by: args.userId ?? null,
  });
  if (error) throw error;
}

async function verifyEvidence(workspaceId: string, evidenceIds: string[]) {
  if (!evidenceIds.length) return;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("evidence_records").select("id").eq("workspace_id", workspaceId).in("id", evidenceIds);
  if (error) throw error;
  if ((data ?? []).length !== evidenceIds.length) throw new Error("evidence_not_found");
}

registerCapabilityHandler(createRecommendationCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const evidenceIds = input.evidenceIds ?? [];
  const replay = await readReplay(ctx.workspaceId, createRecommendationCapability.name, key);
  if (replay && typeof replay === "object" && "recommendationId" in replay) return { output: replay as any, evidenceIds };
  await verifyEvidence(ctx.workspaceId, evidenceIds);
  const supabase = await createSupabaseServerClient();
  if (input.releaseId) {
    const { data } = await supabase.from("releases").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId).maybeSingle();
    if (!data) throw new Error("release_not_found");
  }
  const { data, error } = await supabase.from("recommendations").insert({ workspace_id: ctx.workspaceId, release_id: input.releaseId ?? null, title: input.title, rationale: input.rationale ?? null, priority: input.priority, action_path: input.actionPath ?? null, due_date: input.dueDate ?? null }).select("id").single();
  if (error) throw error;
  const result = { recommendationId: data.id, created: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createRecommendationCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds };
});

registerCapabilityHandler(createContentIdeaCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createContentIdeaCapability.name, key);
  if (replay && typeof replay === "object" && "contentIdeaId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("content_ideas").insert({ workspace_id: ctx.workspaceId, artist_id: input.artistId ?? null, release_id: input.releaseId ?? null, platform: input.platform, format: input.format, hook: input.hook, concept: input.concept ?? null, caption: input.caption ?? null, status: input.status, scheduled_for: input.scheduledFor ?? null }).select("id").single();
  if (error) throw error;
  const result = { contentIdeaId: data.id, created: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createContentIdeaCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(recordMetricSnapshotCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const evidenceIds = input.evidenceIds ?? [];
  const replay = await readReplay(ctx.workspaceId, recordMetricSnapshotCapability.name, key);
  if (replay && typeof replay === "object" && "metricSnapshotId" in replay) return { output: replay as any, evidenceIds };
  await verifyEvidence(ctx.workspaceId, evidenceIds);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("metric_snapshots").upsert({ workspace_id: ctx.workspaceId, artist_id: input.artistId ?? null, release_id: input.releaseId ?? null, platform: input.platform, metric: input.metric, value: input.value, captured_on: input.capturedOn, source_url: input.sourceUrl ?? null }, { onConflict: "workspace_id,artist_id,release_id,platform,metric,captured_on" }).select("id").single();
  if (error) throw error;
  const result = { metricSnapshotId: data.id, recorded: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: recordMetricSnapshotCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds };
});

registerCapabilityHandler(createAutomationPlanCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createAutomationPlanCapability.name, key);
  if (replay && typeof replay === "object" && "automationRuleId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("automation_rules").insert({ workspace_id: ctx.workspaceId, name: input.name, trigger_type: input.triggerType, action_type: input.actionType, trigger_config: { detail: input.triggerDetail ?? "" }, action_config: { detail: input.actionDetail ?? "" }, enabled: false }).select("id").single();
  if (error) throw error;
  const result = { automationRuleId: data.id, created: true, executionMode: "plan_only" as const };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createAutomationPlanCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});
