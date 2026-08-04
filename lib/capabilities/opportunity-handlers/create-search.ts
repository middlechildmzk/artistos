import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildSourcePlan } from "@/lib/network-intelligence/source-runtime/core";
import { registerCapabilityHandler } from "../handlers";
import { createOpportunitySearchCapability } from "../opportunity-registry";
import { readReplay, writeReplay } from "./shared";

registerCapabilityHandler(createOpportunitySearchCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createOpportunitySearchCapability.name, key);
  if (replay && typeof replay === "object" && "searchId" in replay) return { output: replay as never, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  if (input.releaseId) {
    const { data, error } = await supabase.from("releases").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("release_not_found");
  }
  const plan = buildSourcePlan({ query: input.query, objective: input.objective, releaseId: input.releaseId, fitContext: input.fitContext, lanes: input.lanes, requestedSources: input.sources });
  const { data, error } = await supabase.from("opportunity_searches").insert({ workspace_id: ctx.workspaceId, artist_id: ctx.artistId, release_id: input.releaseId ?? null, title: input.title, objective: input.objective, intake: { query: input.query, fit_context: input.fitContext ?? null, requested_sources: input.sources }, search_lanes: plan.lanes, source_plan: plan, status: "draft", execution_mode: "human_operated", created_by: ctx.userId }).select("id").single();
  if (error) throw error;
  const result = { searchId: data.id, laneCount: plan.lanes.length, sourceCount: plan.sourcePolicies.length, created: true as const };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createOpportunitySearchCapability.name, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});
