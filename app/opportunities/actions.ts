"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";
import { semanticIdempotencyKey } from "@/lib/network-intelligence/source-runtime/idempotency";
import { listSourceAdapters } from "@/lib/network-intelligence/source-runtime/registry";

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

export async function searchOpportunityDirectory(formData: FormData) {
  const query = String(formData.get("query") ?? "").trim();
  const genre = String(formData.get("genre") ?? "").trim();
  const territory = String(formData.get("territory") ?? "").trim();
  const releaseId = String(formData.get("releaseId") ?? "") || null;
  const lanes = formData.getAll("lanes").map(String).filter(Boolean);
  const submissionNonce = String(formData.get("submissionNonce") ?? "").trim();
  const maxResultsPerLane = Number(formData.get("maxResultsPerLane") ?? 10);
  if (!query || !submissionNonce) return;

  const effectiveLanes = lanes.length ? lanes : ["radio", "playlist", "youtube_channel", "creator", "publication"];
  const fitContext = [genre, territory].filter(Boolean).join(" · ") || null;
  const availableSources = listSourceAdapters()
    .filter((adapter) => adapter.health().status === "available" && adapter.policy.executionEnabled)
    .map((adapter) => adapter.slug);
  const title = query.slice(0, 120);
  const objective = `Find current ${effectiveLanes.join(", ")} opportunities for ${query}.`;

  const created = assertCompleted(await invokeOpportunity("opportunity.create_search", {
    releaseId,
    title,
    query,
    objective,
    fitContext,
    lanes: effectiveLanes,
    sources: availableSources,
    idempotencyKey: semanticIdempotencyKey("opportunity-search", [query, fitContext, releaseId, effectiveLanes, availableSources, submissionNonce]),
  })) as { searchId?: string };
  if (!created.searchId) return;

  assertCompleted(await invokeOpportunity("opportunity.execute_search", {
    searchId: created.searchId,
    maxResultsPerLane,
    idempotencyKey: semanticIdempotencyKey("opportunity-execute", [created.searchId, maxResultsPerLane, submissionNonce]),
  }));
  revalidatePath("/opportunities");
}

export async function createOpportunitySearch(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim() || `Find evidence-backed targets for ${query}.`;
  const fitContext = String(formData.get("fitContext") ?? "").trim() || null;
  const releaseId = String(formData.get("releaseId") ?? "") || null;
  const lanes = formData.getAll("lanes").map(String).filter(Boolean);
  const sources = formData.getAll("sources").map(String).filter(Boolean);
  const submissionNonce = String(formData.get("submissionNonce") ?? "").trim();
  if (!title || !query || !submissionNonce) return;
  const effectiveLanes = lanes.length ? lanes : ["radio"];
  const effectiveSources = sources.length ? sources : ["wikidata"];
  const result = await invokeOpportunity("opportunity.create_search", {
    releaseId,
    title,
    query,
    objective,
    fitContext,
    lanes: effectiveLanes,
    sources: effectiveSources,
    idempotencyKey: semanticIdempotencyKey("opportunity-search", [title, query, objective, fitContext, releaseId, effectiveLanes, effectiveSources, submissionNonce]),
  });
  assertCompleted(result);
  revalidatePath("/opportunities");
}

export async function executeOpportunitySearch(formData: FormData) {
  const searchId = String(formData.get("searchId") ?? "");
  const maxResultsPerLane = Number(formData.get("maxResultsPerLane") ?? 12);
  const submissionNonce = String(formData.get("submissionNonce") ?? "").trim();
  if (!searchId || !submissionNonce) return;
  const result = await invokeOpportunity("opportunity.execute_search", {
    searchId,
    maxResultsPerLane,
    idempotencyKey: semanticIdempotencyKey("opportunity-execute", [searchId, maxResultsPerLane, submissionNonce]),
  });
  assertCompleted(result);
  revalidatePath("/opportunities");
}

export async function reviewOpportunity(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const disposition = String(formData.get("disposition") ?? "verify_more");
  const matchValue = String(formData.get("match") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const submissionNonce = String(formData.get("submissionNonce") ?? "").trim();
  if (!opportunityId || !submissionNonce) return;
  const [matchCandidateId, matchedEntityType, matchedEntityId] = matchValue ? matchValue.split(":") : [null, null, null];
  const result = await invokeOpportunity("opportunity.review", {
    opportunityId,
    disposition,
    matchCandidateId: matchCandidateId || null,
    matchedEntityType: matchedEntityType || null,
    matchedEntityId: matchedEntityId || null,
    note,
    idempotencyKey: semanticIdempotencyKey("opportunity-review", [opportunityId, disposition, matchValue, note, submissionNonce]),
  });
  assertCompleted(result);
  revalidatePath("/opportunities");
}

export async function requestOpportunityPromotion(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "") || null;
  const submissionNonce = String(formData.get("submissionNonce") ?? "").trim();
  if (!opportunityId || !submissionNonce) return;
  const result = await invokeOpportunity("opportunity.promote_to_crm", {
    opportunityId,
    campaignId,
    idempotencyKey: semanticIdempotencyKey("opportunity-promote", [opportunityId, campaignId, submissionNonce]),
  });
  const output = assertCompleted(result) as { approvalId?: string };
  revalidatePath("/opportunities");
  revalidatePath("/approvals");
  if (output.approvalId) redirect("/approvals");
}
