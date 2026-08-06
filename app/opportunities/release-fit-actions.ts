"use server";

import { revalidatePath } from "next/cache";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";
import { semanticIdempotencyKey } from "@/lib/network-intelligence/source-runtime/idempotency";

/**
 * Routes never write to domain tables directly. Every mutation below goes
 * through invokeCapability so that authorization, policy, replay, and audit
 * receipts apply uniformly.
 *
 * Idempotency keys are derived from the semantic content of the action, so a
 * double submit collapses instead of producing a duplicate decision.
 */
async function invokeReleaseFit(name: string, input: Record<string, unknown>) {
  const ctx = await createActorContext();
  return invokeCapability({
    name,
    ctx,
    input,
    idempotencyKey: String(input.idempotencyKey),
    dependencies: createServerInvocationDependencies(),
  });
}

function assertCompleted(result: Awaited<ReturnType<typeof invokeReleaseFit>>) {
  if (result.status === "ok") return result.output;
  if (result.status === "requires_approval") return { approvalId: result.approvalId };
  if (result.status === "denied") throw new Error(`Action denied by ${result.policy}: ${result.reason}`);
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

function tagList(formData: FormData, field: string) {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 24);
}

/** An empty select means "not recorded", which is null, not a value. */
function submissionNonce(formData: FormData) {
  const value = String(formData.get("submissionNonce") ?? "").trim();
  if (!value) throw new Error("submission_nonce_required");
  return value;
}

function optionalEnum(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value ? value : null;
}

export async function saveReleaseSourcingProfile(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  if (!releaseId) return;
  const subgenreTags = tagList(formData, "subgenreTags");
  const moodTags = tagList(formData, "moodTags");
  const lyricalThemes = tagList(formData, "lyricalThemes");
  const territoryFocus = tagList(formData, "territoryFocus");
  const vocalType = optionalEnum(formData, "vocalType");
  const aiInvolvement = optionalEnum(formData, "aiInvolvement");
  const aiDisclosurePreference = optionalEnum(formData, "aiDisclosurePreference");
  const artistSizeBand = optionalEnum(formData, "artistSizeBand");
  const primaryLanguage = String(formData.get("primaryLanguage") ?? "").trim() || null;

  assertCompleted(
    await invokeReleaseFit("release.set_sourcing_profile", {
      releaseId,
      subgenreTags: subgenreTags.length ? subgenreTags : null,
      moodTags: moodTags.length ? moodTags : null,
      lyricalThemes: lyricalThemes.length ? lyricalThemes : null,
      territoryFocus: territoryFocus.length ? territoryFocus : null,
      vocalType,
      aiInvolvement,
      aiDisclosurePreference,
      artistSizeBand,
      primaryLanguage,
      idempotencyKey: semanticIdempotencyKey("release-profile", [
        releaseId,
        submissionNonce(formData),
        subgenreTags,
        moodTags,
        lyricalThemes,
        territoryFocus,
        vocalType,
        aiInvolvement,
        aiDisclosurePreference,
        artistSizeBand,
        primaryLanguage,
      ]),
    }),
  );
  revalidatePath("/network");
}

export async function confirmSimilarArtist(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const artistName = String(formData.get("artistName") ?? "").trim();
  if (!releaseId || !artistName) return;
  const confirmationState = String(formData.get("confirmationState") ?? "user_confirmed");
  const canonicalUrl = String(formData.get("canonicalUrl") ?? "").trim() || null;
  const sourceSlug = String(formData.get("sourceSlug") ?? "").trim() || null;
  const wikidataId = String(formData.get("wikidataId") ?? "").trim();
  const externalIdentifiers: Record<string, string> = {};
  if (wikidataId) externalIdentifiers.wikidata = wikidataId;
  if (confirmationState === "user_confirmed" && !canonicalUrl && !wikidataId) throw new Error("stable_artist_identity_required");

  assertCompleted(
    await invokeReleaseFit("release.upsert_similar_artist", {
      releaseId,
      artistName,
      sourceSlug,
      canonicalUrl,
      externalIdentifiers,
      confirmationState,
      observedAt: new Date().toISOString(),
      freshnessStatus: "current",
      idempotencyKey: semanticIdempotencyKey("release-similar-artist", [
        releaseId,
        submissionNonce(formData),
        artistName,
        confirmationState,
        canonicalUrl,
        wikidataId,
      ]),
    }),
  );
  revalidatePath("/network");
}

export async function recordTargetDecision(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!releaseId || !opportunityId || !decision) return;
  const note = String(formData.get("note") ?? "").trim() || null;

  assertCompleted(
    await invokeReleaseFit("release.record_target_decision", {
      releaseId,
      opportunityId,
      decision,
      note,
      idempotencyKey: semanticIdempotencyKey("release-decision", [releaseId, opportunityId, decision, note, submissionNonce(formData)]),
    }),
  );
  revalidatePath("/network");
}

export async function updateShortlistItem(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!releaseId || !opportunityId) return;
  const rankRaw = String(formData.get("rank") ?? "").trim();
  const rank = rankRaw ? Number(rankRaw) : null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const proposedCampaignId = String(formData.get("proposedCampaignId") ?? "").trim() || null;

  assertCompleted(
    await invokeReleaseFit("release.update_shortlist_item", {
      releaseId,
      opportunityId,
      rank: Number.isFinite(rank) ? rank : null,
      note,
      proposedCampaignId,
      idempotencyKey: semanticIdempotencyKey("release-shortlist", [
        releaseId,
        submissionNonce(formData),
        opportunityId,
        rank,
        note,
        proposedCampaignId,
      ]),
    }),
  );
  revalidatePath("/network");
}
