"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

function safeError(error: unknown) {
  const value = error instanceof Error ? error.message : "soundcharts_release_pilot_failed";
  return value.replace(/[^a-zA-Z0-9_:\-. ]/g, "").slice(0, 240) || "soundcharts_release_pilot_failed";
}

export async function syncSoundchartsReleasePilot(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  if (!releaseId) redirect("/connections?error=release_required");

  try {
    const ctx = await createActorContext();
    const idempotencyKey = `soundcharts-release-pilot:${releaseId}:${new Date().toISOString()}:${randomUUID()}`;
    const result = await invokeCapability({
      name: "integrations.sync_soundcharts_release_pilot",
      ctx,
      input: { releaseId, idempotencyKey },
      idempotencyKey,
      dependencies: createServerInvocationDependencies(),
    });
    if (result.status === "requires_approval") throw new Error(`approval_required:${result.approvalId}`);
    if (result.status === "denied") throw new Error(`capability_denied:${result.policy}:${result.reason}`);
    if (result.status === "error") throw new Error(`${result.error.code}:${result.error.message}`);

    const output = result.output as {
      playlistCount?: number;
      radioSpinCount?: number;
      chartCount?: number;
      metricCount?: number;
    };
    revalidatePath("/connections");
    revalidatePath("/insights");
    revalidatePath("/proof");
    redirect(`/connections?synced=soundcharts-release&metrics=${output.metricCount ?? 0}&playlists=${output.playlistCount ?? 0}&radio=${output.radioSpinCount ?? 0}&charts=${output.chartCount ?? 0}`);
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
}
