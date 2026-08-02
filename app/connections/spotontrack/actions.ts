"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

function safeError(error: unknown) {
  const value = error instanceof Error ? error.message : "spotontrack_action_failed";
  return value.replace(/[^a-zA-Z0-9_:\-. ]/g, "").slice(0, 240) || "spotontrack_action_failed";
}

async function invoke(name: string, input: Record<string, unknown>, idempotencyKey: string) {
  const ctx = await createActorContext();
  const result = await invokeCapability({ name, ctx, input: { ...input, idempotencyKey }, idempotencyKey, dependencies: createServerInvocationDependencies() });
  if (result.status === "ok") return result.output;
  if (result.status === "requires_approval") throw new Error(`approval_required:${result.approvalId}`);
  if (result.status === "denied") throw new Error(`capability_denied:${result.policy}:${result.reason}`);
  throw new Error(`${result.error.code}:${result.error.message}`);
}

export async function connectSpotOnTrack(formData: FormData) {
  try {
    const apiKey = String(formData.get("apiKey") ?? "").trim();
    const accountLabel = String(formData.get("accountLabel") ?? "").trim() || null;
    if (!apiKey) throw new Error("spotontrack_api_key_required");
    await invoke("integrations.connect_spotontrack", { apiKey, accountLabel }, `spotontrack-connect:${randomUUID()}`);
  } catch (error) {
    redirect(`/connections/spotontrack?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect("/connections/spotontrack?connected=1");
}

export async function syncSpotOnTrack(formData: FormData) {
  let metricCount = 0;
  try {
    const releaseId = String(formData.get("releaseId") ?? "");
    if (!releaseId) throw new Error("release_required");
    const output = await invoke("integrations.sync_spotontrack", { releaseId }, `spotontrack-sync:${releaseId}:${new Date().toISOString()}:${randomUUID()}`) as { metricCount?: number };
    metricCount = output.metricCount ?? 0;
  } catch (error) {
    redirect(`/connections/spotontrack?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections/spotontrack?synced=1&metrics=${metricCount}`);
}
