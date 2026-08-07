import "server-only";

import "./soundcharts-release-pilot-handlers";
import { probeSoundchartsSandbox } from "@/lib/integrations/soundcharts-sandbox";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import { verifySoundchartsSandboxCapability } from "./music-activity-registry";

function requireUserId(value: string | null) {
  if (!value) throw new Error("user_context_required");
  return value;
}

async function readReplay(workspaceId: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("capability_idempotency")
    .select("result")
    .eq("workspace_id", workspaceId)
    .eq("capability_name", verifySoundchartsSandboxCapability.name)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: {
  workspaceId: string;
  key: string;
  result: unknown;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: verifySoundchartsSandboxCapability.name,
    capability_version: verifySoundchartsSandboxCapability.version,
    idempotency_key: args.key,
    input_hash: args.key,
    result: args.result,
    created_by: args.userId,
  });
  if (error) throw error;
}

registerCapabilityHandler(verifySoundchartsSandboxCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, key);
  if (replay && typeof replay === "object" && "evidenceId" in replay) {
    const evidenceId = String((replay as Record<string, unknown>).evidenceId);
    return { output: replay as any, evidenceIds: [evidenceId] };
  }

  const observation = await probeSoundchartsSandbox();
  const supabase = await createSupabaseServerClient();
  const { data: evidence, error: evidenceError } = await supabase.from("evidence_records").insert({
    workspace_id: ctx.workspaceId,
    artist_id: null,
    release_id: null,
    evidence_type: "soundcharts_sandbox_probe",
    source_type: "api_response",
    source_uri: "https://customer.api.soundcharts.com/api/v2/artist/search/Billie%20Eilish?limit=1",
    summary: `Soundcharts sandbox accepted a read-only request and returned ${observation.resultCount} sandbox result entries. This does not establish production access or Middle Child coverage.`,
    confidence: "verified",
    confidence_score: 1,
    observed_at: observation.checkedAt,
    captured_by: userId,
    metadata: {
      ...observation,
      idempotency_key: key,
      verification_boundary: "sandbox_contract_only",
      middle_child_coverage_verified: false,
      production_provider_verified: false,
    },
    verification_status: "verified",
    verification_method: "soundcharts_public_sandbox_api",
    contradiction_state: "clear",
  }).select("id").single();
  if (evidenceError) throw evidenceError;

  const result = { ...observation, evidenceId: evidence.id as string };
  await writeReplay({ workspaceId: ctx.workspaceId, key, result, userId });
  return { output: result, evidenceIds: [evidence.id as string] };
});
