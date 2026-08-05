import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeName } from "@/lib/network-intelligence/source-runtime/matching";
import { deriveReadiness } from "@/lib/release-fit/readiness";
import { registerCapabilityHandler } from "./handlers";
import { readReplay, writeReplay } from "./opportunity-handlers/shared";
import {
  recordTargetDecisionCapability,
  setReleaseSourcingProfileCapability,
  updateShortlistItemCapability,
  upsertSimilarArtistCapability,
} from "./release-fit-registry";

/**
 * Every handler resolves the release inside the acting workspace before writing,
 * and every write carries an explicit workspace_id. No column default is relied
 * upon for tenancy.
 */
async function requireRelease(workspaceId: string, releaseId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("releases")
    .select("id,status")
    .eq("workspace_id", workspaceId)
    .eq("id", releaseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("release_not_found");
  return data;
}

async function requireOpportunity(workspaceId: string, opportunityId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select("id,review_status,source_policy_disposition,external_id,canonical_url,corroboration_count,risk_flags")
    .eq("workspace_id", workspaceId)
    .eq("id", opportunityId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("opportunity_not_found");
  return data;
}

registerCapabilityHandler(setReleaseSourcingProfileCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, setReleaseSourcingProfileCapability.name, key);
  if (replay && typeof replay === "object" && "releaseId" in replay) return { output: replay as never, evidenceIds: [] };
  await requireRelease(ctx.workspaceId, input.releaseId);
  const supabase = await createSupabaseServerClient();

  // Only fields explicitly present in the input are written. An omitted field is
  // left untouched so that "not supplied" never overwrites recorded evidence,
  // and an explicit null clears a field back to unknown.
  const columnByField: Record<string, string> = {
    subgenreTags: "subgenre_tags",
    moodTags: "mood_tags",
    lyricalThemes: "lyrical_themes",
    vocalType: "vocal_type",
    territoryFocus: "territory_focus",
    primaryLanguage: "primary_language",
    aiInvolvement: "ai_involvement",
    aiDisclosurePreference: "ai_disclosure_preference",
    artistSizeBand: "artist_size_band",
  };
  const patch: Record<string, unknown> = {};
  const updatedFields: string[] = [];
  for (const [field, column] of Object.entries(columnByField)) {
    if (!(field in input)) continue;
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    patch[column] = value;
    updatedFields.push(column);
  }

  if (updatedFields.length) {
    patch.sourcing_metadata_updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("releases")
      .update(patch)
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", input.releaseId);
    if (error) throw error;
  }

  const result = { releaseId: input.releaseId, updatedFields, changed: updatedFields.length > 0 };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: setReleaseSourcingProfileCapability.name, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(upsertSimilarArtistCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, upsertSimilarArtistCapability.name, key);
  if (replay && typeof replay === "object" && "similarArtistId" in replay) return { output: replay as never, evidenceIds: [] };
  await requireRelease(ctx.workspaceId, input.releaseId);
  const supabase = await createSupabaseServerClient();

  const identifiers = input.externalIdentifiers ?? {};
  const externalIdentity = Object.entries(identifiers)
    .map(([scheme, value]) => [scheme.trim().toLowerCase(), typeof value === "string" ? value.trim() : ""] as const)
    .filter(([, value]) => Boolean(value))
    .sort(([a], [b]) => a.localeCompare(b))[0] ?? null;
  const hasExternalIdentity = Boolean(externalIdentity || input.canonicalUrl);
  if (input.confirmationState === "user_confirmed" && !hasExternalIdentity) {
    throw new Error("stable_artist_identity_required");
  }
  const identityKey = externalIdentity
    ? `external:${externalIdentity[0]}:${externalIdentity[1].toLowerCase()}`
    : input.canonicalUrl
      ? `url:${input.canonicalUrl.trim().toLowerCase()}`
      : `unresolved:${randomUUID()}`;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("release_similar_artists")
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        release_id: input.releaseId,
        identity_key: identityKey,
        artist_name: input.artistName,
        normalized_name: normalizeName(input.artistName),
        source_slug: input.sourceSlug ?? null,
        canonical_url: input.canonicalUrl ?? null,
        external_identifiers: identifiers,
        confirmation_state: input.confirmationState,
        confidence: input.confidence ?? null,
        evidence_id: input.evidenceId ?? null,
        observed_at: input.observedAt ?? null,
        freshness_status: input.freshnessStatus ?? null,
        note: input.note ?? null,
        created_by: ctx.userId,
        confirmed_by: input.confirmationState === "user_confirmed" ? ctx.userId : null,
        confirmed_at: input.confirmationState === "user_confirmed" ? now : null,
        updated_at: now,
      },
      { onConflict: "workspace_id,release_id,identity_key" },
    )
    .select("id")
    .single();
  if (error) throw error;

  const result = {
    releaseId: input.releaseId,
    similarArtistId: data.id,
    confirmationState: input.confirmationState,
    // A confirmed comparable artist without an external identifier can be
    // displayed, but it can never be used as similar-artist match evidence,
    // because name agreement alone does not establish identity.
    usableAsFitEvidence: input.confirmationState === "user_confirmed" && hasExternalIdentity,
  };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: upsertSimilarArtistCapability.name, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: input.evidenceId ? [input.evidenceId] : [] };
});

registerCapabilityHandler(recordTargetDecisionCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, recordTargetDecisionCapability.name, key);
  if (replay && typeof replay === "object" && "decision" in replay) return { output: replay as never, evidenceIds: [] };
  await requireRelease(ctx.workspaceId, input.releaseId);
  const opportunity = await requireOpportunity(ctx.workspaceId, input.opportunityId);
  const supabase = await createSupabaseServerClient();

  if (input.decision === "cleared") {
    const scope = { workspace_id: ctx.workspaceId, release_id: input.releaseId, opportunity_id: input.opportunityId };
    const { error: decisionError } = await supabase
      .from("release_target_decisions")
      .delete()
      .match(scope);
    if (decisionError) throw decisionError;
    const { error: shortlistError } = await supabase.from("release_shortlist_items").delete().match(scope);
    if (shortlistError) throw shortlistError;
    const cleared = { releaseId: input.releaseId, opportunityId: input.opportunityId, decision: "cleared", shortlisted: false };
    await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: recordTargetDecisionCapability.name, key, result: cleared, userId: ctx.userId });
    return { output: cleared, evidenceIds: [] };
  }

  const { error } = await supabase.from("release_target_decisions").upsert(
    {
      workspace_id: ctx.workspaceId,
      release_id: input.releaseId,
      opportunity_id: input.opportunityId,
      decision: input.decision,
      note: input.note ?? null,
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,release_id,opportunity_id" },
  );
  if (error) throw error;

  const shortlisted = input.decision === "shortlisted";
  if (shortlisted) {
    const readiness = deriveReadiness(opportunity);
    const { error: shortlistError } = await supabase.from("release_shortlist_items").upsert(
      {
        workspace_id: ctx.workspaceId,
        release_id: input.releaseId,
        opportunity_id: input.opportunityId,
        readiness_state: readiness.state,
        blocking_reasons: readiness.blocking,
        added_by: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,release_id,opportunity_id" },
    );
    if (shortlistError) throw shortlistError;
  } else {
    const { error: removeError } = await supabase.from("release_shortlist_items").delete().match({
      workspace_id: ctx.workspaceId,
      release_id: input.releaseId,
      opportunity_id: input.opportunityId,
    });
    if (removeError) throw removeError;
  }

  const result = { releaseId: input.releaseId, opportunityId: input.opportunityId, decision: input.decision, shortlisted };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: recordTargetDecisionCapability.name, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(updateShortlistItemCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, updateShortlistItemCapability.name, key);
  if (replay && typeof replay === "object" && "readinessState" in replay) return { output: replay as never, evidenceIds: [] };
  await requireRelease(ctx.workspaceId, input.releaseId);
  const opportunity = await requireOpportunity(ctx.workspaceId, input.opportunityId);
  const supabase = await createSupabaseServerClient();

  if (input.proposedCampaignId) {
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id,release_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", input.proposedCampaignId)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign || campaign.release_id !== input.releaseId) throw new Error("campaign_not_found");
  }

  const { data: existing, error: existingError } = await supabase
    .from("release_shortlist_items")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("release_id", input.releaseId)
    .eq("opportunity_id", input.opportunityId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("shortlist_item_not_found");

  const readiness = deriveReadiness(opportunity);
  const patch: Record<string, unknown> = {
    readiness_state: readiness.state,
    blocking_reasons: readiness.blocking,
    updated_at: new Date().toISOString(),
  };
  if (input.rank !== undefined && input.rank !== null) patch.rank = input.rank;
  if ("note" in input) patch.note = input.note ?? null;
  if ("proposedCampaignId" in input) patch.proposed_campaign_id = input.proposedCampaignId ?? null;

  const { error } = await supabase
    .from("release_shortlist_items")
    .update(patch)
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", existing.id);
  if (error) throw error;

  const result = {
    releaseId: input.releaseId,
    opportunityId: input.opportunityId,
    readinessState: readiness.state,
    blockingReasons: readiness.blocking,
  };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: updateShortlistItemCapability.name, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});
