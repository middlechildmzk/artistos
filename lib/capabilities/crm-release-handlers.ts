import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import {
  addOrganizationToCampaignCapability,
  addReleaseAssetCapability,
  createReleaseCampaignCapability,
  createReleaseCapability,
  logOutboundOutreachCapability,
  updateOrganizationRelationshipCapability,
  updateReleaseCapability,
} from "./crm-release-registry";

async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("capability_idempotency").select("result").eq("workspace_id", workspaceId).eq("capability_name", capabilityName).eq("idempotency_key", key).maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: { workspaceId: string; capabilityName: string; capabilityVersion: number; key: string; result: unknown; userId?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({ workspace_id: args.workspaceId, capability_name: args.capabilityName, capability_version: args.capabilityVersion, idempotency_key: args.key, input_hash: args.key, result: args.result, created_by: args.userId ?? null });
  if (error) throw error;
}

registerCapabilityHandler(updateOrganizationRelationshipCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, updateOrganizationRelationshipCapability.name, key);
  if (replay && typeof replay === "object" && "organizationId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: current, error: currentError } = await supabase.from("organizations").select("id,relationship_stage,next_action,next_action_due").eq("workspace_id", ctx.workspaceId).eq("id", input.organizationId).maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error("organization_not_found");
  const changed = current.relationship_stage !== input.relationshipStage || current.next_action !== (input.nextAction ?? null) || current.next_action_due !== (input.nextActionDue ?? null);
  if (changed) {
    const { error } = await supabase.from("organizations").update({ relationship_stage: input.relationshipStage, next_action: input.nextAction ?? null, next_action_due: input.nextActionDue ?? null }).eq("workspace_id", ctx.workspaceId).eq("id", input.organizationId);
    if (error) throw error;
  }
  const result = { organizationId: input.organizationId, relationshipStage: input.relationshipStage, changed };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: updateOrganizationRelationshipCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(addOrganizationToCampaignCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, addOrganizationToCampaignCapability.name, key);
  if (replay && typeof replay === "object" && "campaignTargetId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const [{ data: organization, error: organizationError }, { data: campaign, error: campaignError }] = await Promise.all([
    supabase.from("organizations").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.organizationId).maybeSingle(),
    supabase.from("campaigns").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.campaignId).maybeSingle(),
  ]);
  if (organizationError) throw organizationError;
  if (campaignError) throw campaignError;
  if (!organization) throw new Error("organization_not_found");
  if (!campaign) throw new Error("campaign_not_found");
  const { data: existing, error: existingError } = await supabase.from("campaign_targets").select("id").eq("workspace_id", ctx.workspaceId).eq("campaign_id", input.campaignId).eq("target_kind", "organization").eq("target_id", input.organizationId).maybeSingle();
  if (existingError) throw existingError;
  let campaignTargetId = existing?.id;
  let created = false;
  if (!campaignTargetId) {
    const { data, error } = await supabase.from("campaign_targets").insert({ workspace_id: ctx.workspaceId, campaign_id: input.campaignId, target_kind: "organization", target_id: input.organizationId, status: "queued" }).select("id").single();
    if (error) throw error;
    campaignTargetId = data.id;
    created = true;
  }
  const { error: relationshipError } = await supabase.from("organizations").update({ relationship_stage: "qualified", next_action: "Draft and send campaign pitch" }).eq("workspace_id", ctx.workspaceId).eq("id", input.organizationId);
  if (relationshipError) throw relationshipError;
  const result = { organizationId: input.organizationId, campaignId: input.campaignId, campaignTargetId, created };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: addOrganizationToCampaignCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(logOutboundOutreachCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, logOutboundOutreachCapability.name, key);
  if (replay && typeof replay === "object" && "interactionId" in replay) return { output: replay as any, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const { data: organization, error: organizationError } = await supabase.from("organizations").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.organizationId).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization) throw new Error("organization_not_found");

  let campaign: { id: string; release_id: string | null } | null = null;
  if (input.campaignId) {
    const { data, error } = await supabase.from("campaigns").select("id,release_id").eq("workspace_id", ctx.workspaceId).eq("id", input.campaignId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("campaign_not_found");
    campaign = data;
  }

  let endpoint: { id: string; organization_id: string | null; property_id: string | null } | null = null;
  if (input.endpointId) {
    const { data, error } = await supabase.from("submission_endpoints").select("id,organization_id,property_id").eq("workspace_id", ctx.workspaceId).eq("id", input.endpointId).maybeSingle();
    if (error) throw error;
    if (!data || data.organization_id !== input.organizationId) throw new Error("submission_endpoint_not_found");
    endpoint = data;
  }

  let campaignTargetId: string | null = null;
  if (campaign) {
    const { data: existingTarget, error: targetLookupError } = await supabase
      .from("campaign_targets")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("campaign_id", campaign.id)
      .eq("target_kind", "organization")
      .eq("target_id", input.organizationId)
      .maybeSingle();
    if (targetLookupError) throw targetLookupError;
    campaignTargetId = existingTarget?.id ?? null;
    if (!campaignTargetId) {
      const { data: createdTarget, error: targetInsertError } = await supabase
        .from("campaign_targets")
        .insert({ workspace_id: ctx.workspaceId, campaign_id: campaign.id, target_kind: "organization", target_id: input.organizationId, status: "queued" })
        .select("id")
        .single();
      if (targetInsertError) throw targetInsertError;
      campaignTargetId = createdTarget.id;
    }
  }

  const { data: interaction, error } = await supabase.from("interactions").insert({ workspace_id: ctx.workspaceId, organization_id: input.organizationId, campaign_id: input.campaignId ?? null, endpoint_id: input.endpointId ?? null, direction: "outbound", channel: input.channel, subject: input.subject, body: input.body ?? null, asset_link: input.assetLink ?? null, reply_status: "none", follow_up_due: input.followUpDue ?? null, follow_up_done: false }).select("id").single();
  if (error) throw error;

  let campaignTargetUpdated = false;
  const evidenceIds: string[] = [];
  if (campaign && campaignTargetId) {
    const { error: targetError } = await supabase.from("campaign_targets").update({ status: "pitched", updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", campaignTargetId);
    if (targetError) throw targetError;
    campaignTargetUpdated = true;

    const now = new Date().toISOString();
    const { data: submission, error: submissionError } = await supabase
      .from("campaign_submissions")
      .insert({
        workspace_id: ctx.workspaceId,
        campaign_id: campaign.id,
        release_id: campaign.release_id,
        campaign_target_id: campaignTargetId,
        property_id: endpoint?.property_id ?? null,
        submission_mode: input.channel,
        status: "submitted",
        artist_message: input.body ?? null,
        terms: endpoint ? { endpointId: endpoint.id } : {},
        submitted_at: now,
      })
      .select("id")
      .single();
    if (submissionError) throw submissionError;

    const { data: evidence, error: evidenceError } = await supabase
      .from("evidence_records")
      .insert({
        workspace_id: ctx.workspaceId,
        release_id: campaign.release_id,
        campaign_id: campaign.id,
        campaign_target_id: campaignTargetId,
        evidence_type: "campaign_submission",
        source_type: "human_attestation",
        source_uri: input.assetLink ?? null,
        summary: input.subject,
        confidence: "supported",
        observed_at: now,
        captured_by: ctx.userId ?? null,
        verification_method: "human_attestation",
        verification_status: "pending",
        confidence_score: 0.7,
        contradiction_state: "clear",
        metadata: { interactionId: interaction.id, submissionId: submission.id, endpointId: endpoint?.id ?? null, channel: input.channel },
      })
      .select("id")
      .single();
    if (evidenceError) throw evidenceError;
    evidenceIds.push(evidence.id);
  }

  const { error: relationshipError } = await supabase.from("organizations").update({ relationship_stage: "pitched", next_action: input.followUpDue ? "Follow up on campaign pitch" : "Monitor for reply", next_action_due: input.followUpDue ?? null }).eq("workspace_id", ctx.workspaceId).eq("id", input.organizationId);
  if (relationshipError) throw relationshipError;

  const result = { interactionId: interaction.id, organizationId: input.organizationId, campaignTargetUpdated };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: logOutboundOutreachCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds };
});

registerCapabilityHandler(createReleaseCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createReleaseCapability.name, key);
  if (replay && typeof replay === "object" && "releaseId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: artist, error: artistError } = await supabase.from("artists").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.artistId).maybeSingle();
  if (artistError) throw artistError;
  if (!artist) throw new Error("artist_not_found");
  const { data: release, error } = await supabase.from("releases").insert({ workspace_id: ctx.workspaceId, artist_id: input.artistId, title: input.title, featured_artist: input.featuredArtist ?? null, release_date: input.releaseDate ?? null, distributor: input.distributor ?? null, label: input.label ?? null, status: input.releaseDate ? "upcoming" : "draft" }).select("id").single();
  if (error) throw error;
  const starterTasks = [["Confirm master audio", "Verify final mix, master format, loudness, and filename."], ["Finalize original artwork", "Confirm store-safe square artwork and ownership."], ["Lock metadata", "Verify artist styling, title, featured artist, label, ISRC, UPC, and release date."], ["Prepare platform pitch", "Draft the editorial pitch, genres, moods, instruments, and campaign story."], ["Build release campaign", "Create the target list, outreach plan, content schedule, and follow-up rhythm."]];
  const { error: taskError } = await supabase.from("tasks").insert(starterTasks.map(([title, detail], index) => ({ workspace_id: ctx.workspaceId, release_id: release.id, title, detail, classification: "spine", status: "open", sort_order: (index + 1) * 10 })));
  if (taskError) throw taskError;
  const result = { releaseId: release.id, created: true, starterTaskCount: starterTasks.length };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createReleaseCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(updateReleaseCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, updateReleaseCapability.name, key);
  if (replay && typeof replay === "object" && "releaseId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: current, error: currentError } = await supabase.from("releases").select("id,status").eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId).maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error("release_not_found");
  const { error } = await supabase.from("releases").update({ title: input.title, featured_artist: input.featuredArtist ?? null, release_date: input.releaseDate ?? null, distributor: input.distributor ?? null, label: input.label ?? null, isrc: input.isrc ?? null, upc: input.upc ?? null, spotify_url: input.spotifyUrl ?? null, status: input.status, notes: input.notes ?? null }).eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId);
  if (error) throw error;
  const result = { releaseId: input.releaseId, status: input.status, changed: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: updateReleaseCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(addReleaseAssetCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, addReleaseAssetCapability.name, key);
  if (replay && typeof replay === "object" && "assetId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: release, error: releaseError } = await supabase.from("releases").select("id,artist_id").eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId).maybeSingle();
  if (releaseError) throw releaseError;
  if (!release) throw new Error("release_not_found");
  const { data: asset, error } = await supabase.from("assets").insert({ workspace_id: ctx.workspaceId, release_id: input.releaseId, artist_id: release.artist_id, name: input.name, asset_type: input.assetType, url: input.url ?? null, location_note: input.locationNote ?? null, status: input.status }).select("id").single();
  if (error) throw error;
  const result = { assetId: asset.id, releaseId: input.releaseId, created: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: addReleaseAssetCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(createReleaseCampaignCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createReleaseCampaignCapability.name, key);
  if (replay && typeof replay === "object" && "campaignId" in replay) return { output: replay as any, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: release, error: releaseError } = await supabase.from("releases").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId).maybeSingle();
  if (releaseError) throw releaseError;
  if (!release) throw new Error("release_not_found");
  const { data: campaign, error } = await supabase.from("campaigns").insert({ workspace_id: ctx.workspaceId, release_id: input.releaseId, name: input.name, status: "active", start_date: input.startDate ?? null, end_date: input.endDate ?? null, goals: input.goals ?? null }).select("id").single();
  if (error) throw error;
  const result = { campaignId: campaign.id, releaseId: input.releaseId, created: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: createReleaseCampaignCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});
