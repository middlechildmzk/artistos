"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

function safeError(error: unknown) {
  const value = error instanceof Error ? error.message : "source_action_failed";
  return value.replace(/[^a-zA-Z0-9_:\-. ]/g, "").slice(0, 240) || "source_action_failed";
}

export async function verifySoundchartsSandbox() {
  let resultCount = 0;
  try {
    const ctx = await createActorContext();
    const idempotencyKey = `soundcharts-sandbox:${new Date().toISOString()}:${randomUUID()}`;
    const result = await invokeCapability<{
      resultCount: number;
      productionAccess: false;
      credentialsStored: false;
    }>({
      name: "integrations.verify_soundcharts_sandbox",
      ctx,
      input: { idempotencyKey },
      idempotencyKey,
      dependencies: createServerInvocationDependencies(),
    });
    if (result.status === "requires_approval") throw new Error(`approval_required:${result.approvalId}`);
    if (result.status === "denied") throw new Error(`capability_denied:${result.policy}:${result.reason}`);
    if (result.status === "failed") throw new Error(`${result.error.code}:${result.error.message}`);
    resultCount = result.output.resultCount;
    revalidatePath("/connections");
    revalidatePath("/insights");
    revalidatePath("/proof");
  } catch (error) {
    redirect(`/connections?error=${encodeURIComponent(safeError(error))}`);
  }
  redirect(`/connections?synced=soundcharts-sandbox&metrics=${resultCount}`);
}
