import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordPublicLinkEvent, type PublicLinkRecord } from "@/lib/public-links";
import { registerCapabilityHandler } from "./handlers";
import { capturePublicLinkFanCapability } from "./public-links-registry";

async function readReplay(workspaceId: string, key: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("capability_idempotency")
    .select("result,input_hash")
    .eq("workspace_id", workspaceId)
    .eq("capability_name", capturePublicLinkFanCapability.name)
    .eq("capability_version", capturePublicLinkFanCapability.version)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function writeReplay(args: { workspaceId: string; key: string; inputHash: string; result: unknown }) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: capturePublicLinkFanCapability.name,
    capability_version: capturePublicLinkFanCapability.version,
    idempotency_key: args.key,
    input_hash: args.inputHash,
    result: args.result,
    created_by: null,
  });
  if (error?.code !== "23505") {
    if (error) throw error;
    return;
  }

  const replay = await readReplay(args.workspaceId, args.key);
  if (!replay || replay.input_hash !== args.inputHash) throw new Error("idempotency_conflict");
}

registerCapabilityHandler(capturePublicLinkFanCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const inputHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)))
    .then((digest) => Buffer.from(digest).toString("hex"));
  const replay = await readReplay(ctx.workspaceId, key);
  if (replay) {
    if (replay.input_hash !== inputHash) throw new Error("idempotency_conflict");
    return { output: replay.result as any, evidenceIds: [] };
  }

  const supabase = createSupabaseAdminClient();
  const { data: linkRow, error: linkError } = await supabase
    .from("smart_links")
    .select("id,workspace_id,release_id,slug,mode,headline,description,capture_email,consent_copy_version")
    .eq("id", input.linkId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("is_active", true)
    .neq("mode", "private")
    .maybeSingle();
  if (linkError) throw linkError;
  if (!linkRow) throw new Error("link_not_found");
  if (!linkRow.capture_email) throw new Error("capture_disabled");

  const now = new Date().toISOString();
  const { data: existingFan, error: existingFanError } = await supabase
    .from("fans")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .ilike("email", input.email)
    .is("archived_at", null)
    .maybeSingle();
  if (existingFanError) throw existingFanError;

  let fanId = existingFan?.id ?? null;
  let created = false;
  if (fanId) {
    const updates: Record<string, unknown> = {
      consent_status: "subscribed",
      consent_source: `artistos_link:${linkRow.slug}`,
      source_smart_link_id: linkRow.id,
      last_seen_at: now,
      consent_last_recorded_at: now,
    };
    if (input.firstName) {
      updates.first_name = input.firstName;
      updates.name = input.firstName;
    }
    const { error } = await supabase.from("fans").update(updates).eq("workspace_id", ctx.workspaceId).eq("id", fanId);
    if (error) throw error;
  } else {
    const { data: createdFan, error: createError } = await supabase
      .from("fans")
      .insert({
        workspace_id: ctx.workspaceId,
        email: input.email,
        name: input.firstName,
        first_name: input.firstName,
        segment: "smart_link",
        consent_status: "subscribed",
        consent_source: `artistos_link:${linkRow.slug}`,
        first_seen: now.slice(0, 10),
        verification_status: "unverified",
        source_smart_link_id: linkRow.id,
        last_seen_at: now,
        consent_last_recorded_at: now,
      })
      .select("id")
      .single();

    if (createError?.code === "23505") {
      const { data: racedFan, error: racedFanError } = await supabase
        .from("fans")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .ilike("email", input.email)
        .is("archived_at", null)
        .single();
      if (racedFanError) throw racedFanError;
      fanId = racedFan.id;
      const { error: updateError } = await supabase
        .from("fans")
        .update({
          consent_status: "subscribed",
          consent_source: `artistos_link:${linkRow.slug}`,
          source_smart_link_id: linkRow.id,
          last_seen_at: now,
          consent_last_recorded_at: now,
        })
        .eq("workspace_id", ctx.workspaceId)
        .eq("id", fanId);
      if (updateError) throw updateError;
    } else if (createError) {
      throw createError;
    } else {
      fanId = createdFan.id;
      created = true;
    }
  }

  if (!fanId) throw new Error("fan_capture_failed");
  const commonEvidence = {
    form_version: "artistos-public-link-v1",
    release_id: linkRow.release_id,
    smart_link_slug: linkRow.slug,
    email_confirmation_status: "unverified",
    utm_source: input.utmSource,
    utm_medium: input.utmMedium,
    utm_campaign: input.utmCampaign,
  };
  const { data: consentRows, error: consentError } = await supabase
    .from("fan_consents")
    .insert([
      {
        workspace_id: ctx.workspaceId,
        fan_id: fanId,
        smart_link_id: linkRow.id,
        consent_type: "email_marketing",
        granted: true,
        policy_version: linkRow.consent_copy_version,
        source_url: `/l/${linkRow.slug}`,
        evidence: { ...commonEvidence, action: "email_updates_checked" },
        recorded_at: now,
      },
      {
        workspace_id: ctx.workspaceId,
        fan_id: fanId,
        smart_link_id: linkRow.id,
        consent_type: "privacy_terms",
        granted: true,
        policy_version: linkRow.consent_copy_version,
        source_url: `/l/${linkRow.slug}`,
        evidence: { ...commonEvidence, action: "privacy_notice_acknowledged" },
        recorded_at: now,
      },
    ])
    .select("id");
  if (consentError) throw consentError;

  const link: PublicLinkRecord = {
    id: linkRow.id,
    workspaceId: linkRow.workspace_id,
    releaseId: linkRow.release_id,
    slug: linkRow.slug,
    mode: linkRow.mode,
    headline: linkRow.headline,
    description: linkRow.description,
    captureEmail: linkRow.capture_email,
    consentCopyVersion: linkRow.consent_copy_version,
    artistName: "",
    releaseTitle: "",
    featuredArtist: null,
    releaseDate: null,
    releaseStatus: "",
    artworkUrl: null,
    destinations: [],
  };
  await recordPublicLinkEvent({
    link,
    eventType: "fan_signup",
    fanId,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    metadata: { collection_version: "public-link-fan-v1", email_confirmation_status: "unverified" },
  });

  const result = { fanId, linkId: linkRow.id, created, consentRecords: consentRows?.length ?? 2 };
  await writeReplay({ workspaceId: ctx.workspaceId, key, inputHash, result });
  return { output: result, evidenceIds: [] };
});
