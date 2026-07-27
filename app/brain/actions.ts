"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

async function invoke(name: string, input: Record<string, unknown>) {
  const ctx = await createActorContext();
  const idempotencyKey = String(input.idempotencyKey);
  const result = await invokeCapability({ name, ctx, input, idempotencyKey, dependencies: createServerInvocationDependencies() });
  if (result.status !== "ok") throw new Error(result.status === "failed" ? result.error.message : `Capability ${result.status}`);
}

export async function createMemory(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const namespace = String(formData.get("namespace") ?? "").trim();
  if (!title || !namespace) return;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  await invoke("brain.create_memory", {
    artistId: String(formData.get("artistId") ?? "") || null,
    memoryClass: String(formData.get("memoryClass") ?? "semantic"),
    namespace,
    title,
    summary,
    content: { value: String(formData.get("value") ?? "").trim() || summary || title },
    sourceKind: "human",
    confidence: String(formData.get("confidence") ?? "supported"),
    observedAt: null,
    evidenceIds: String(formData.get("evidenceIds") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    idempotencyKey: `brain-memory:${randomUUID()}`,
  });
  revalidatePath("/brain");
}

export async function reviewClaim(formData: FormData) {
  const claimId = String(formData.get("claimId") ?? "");
  const reviewStatus = String(formData.get("reviewStatus") ?? "");
  if (!claimId || !reviewStatus) return;
  await invoke("brain.review_claim", { claimId, reviewStatus, reviewNote: String(formData.get("reviewNote") ?? "").trim() || null, idempotencyKey: `brain-review:${claimId}:${randomUUID()}` });
  revalidatePath("/brain");
}