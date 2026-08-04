"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

async function invokeOpportunity(name: string, input: Record<string, unknown>) {
  const ctx = await createActorContext();
  const idempotencyKey = String(input.idempotencyKey);
  return invokeCapability({ name, ctx, input, idempotencyKey, dependencies: createServerInvocationDependencies() });
}

function assertCompleted(result: Awaited<ReturnType<typeof invokeOpportunity>>) {
  if (result.status === "ok") return result.output;
  if (result.status === "requires_approval") return { approvalId: result.approvalId };
  if (result.status === "denied") throw new Error(`Action denied by ${result.policy}: ${result.reason}`);
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

export async function createOpportunitySearch(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  if (!title || !query) return;
  const result = await invokeOpportunity("opportunity.create_search", {
    releaseId: String(formData.get("releaseId") ?? "") || null,
    title,
    query,
    objective: String(formData.get("objective") ?? "").trim() || `Find evidence-backed targets for ${query}.`,
    fitContext: String(formData.get("fitContext") ?? "").trim() || null,
    lanes: formData.getAll("lanes").map(String).filter(Boolean).length ? formData.getAll("lanes").map(String) : ["youtube_channel"],
    sources: formData.getAll("sources").map(String).filter(Boolean).length ? formData.getAll("sources").map(String) : ["wikidata", "youtube"],
    idempotencyKey: `opportunity-search:${randomUUID()}`,
  });
  assertCompleted(result);
  revalidatePath("/opportunities");
}

export async function executeOpportunitySearch(formData: FormData) {
  const searchId = String(formData.get("searchId") ?? "");
  if (!searchId) return;
  const result = await invokeOpportunity("opportunity.execute_search", {
    searchId,
    maxResultsPerLane: Number(formData.get("maxResultsPerLane") ?? 12),
    idempotencyKey: `opportunity-execute:${searchId}:${randomUUID()}`,
  });
  assertCompleted(result);
  revalidatePath("/opportunities");
}

export async function reviewOpportunity(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const disposition = String(formData.get("disposition") ?? "verify_more");
  if (!opportunityId) return;
  const matchValue = String(formData.get("match") ?? "");
  const [matchCandidateId, matchedEntityType, matchedEntityId] = matchValue ? matchValue.split(":") : [null, null, null];
  const result = await invokeOpportunity("opportunity.review", {
    opportunityId,
    disposition,
    matchCandidateId: matchCandidateId || null,
    matchedEntityType: matchedEntityType || null,
    matchedEntityId: matchedEntityId || null,
    note: String(formData.get("note") ?? "").trim() || null,
    idempotencyKey: `opportunity-review:${opportunityId}:${randomUUID()}`,
  });
  assertCompleted(result);
  revalidatePath("/opportunities");
}

export async function requestOpportunityPromotion(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!opportunityId) return;
  const result = await invokeOpportunity("opportunity.promote_to_crm", {
    opportunityId,
    campaignId: String(formData.get("campaignId") ?? "") || null,
    idempotencyKey: `opportunity-promote:${opportunityId}:${randomUUID()}`,
  });
  const output = assertCompleted(result) as { approvalId?: string };
  revalidatePath("/opportunities");
  revalidatePath("/approvals");
  if (output.approvalId) redirect("/approvals");
}
