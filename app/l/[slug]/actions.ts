"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanPublicText, loadPublicLink, recordPublicLinkEvent } from "@/lib/public-links";

function normalizeEmail(value: unknown) {
  const email = cleanPublicText(value, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function capturePublicLinkFan(formData: FormData) {
  const slug = cleanPublicText(formData.get("slug"), 120).toLowerCase();
  const link = await loadPublicLink(slug);
  if (!link || !link.captureEmail) redirect(`/l/${encodeURIComponent(slug)}?signup=unavailable`);

  const email = normalizeEmail(formData.get("email"));
  const firstName = cleanPublicText(formData.get("firstName"), 80);
  const emailConsent = formData.get("emailConsent") === "on";
  const privacyAcknowledged = formData.get("privacyAcknowledged") === "on";
  if (!email || !emailConsent || !privacyAcknowledged) {
    redirect(`/l/${encodeURIComponent(link.slug)}?signup=invalid`);
  }

  const utmSource = cleanPublicText(formData.get("utmSource"), 160);
  const utmMedium = cleanPublicText(formData.get("utmMedium"), 160);
  const utmCampaign = cleanPublicText(formData.get("utmCampaign"), 160);
  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();

  const { data: existingFan, error: existingFanError } = await supabase
    .from("fans")
    .select("id")
    .eq("workspace_id", link.workspaceId)
    .ilike("email", email)
    .is("archived_at", null)
    .maybeSingle();
  if (existingFanError) throw existingFanError;

  let fanId = existingFan?.id ?? null;
  if (fanId) {
    const fanUpdates: Record<string, unknown> = {
      consent_status: "subscribed",
      consent_source: `artistos_link:${link.slug}`,
      source_smart_link_id: link.id,
      last_seen_at: now,
      consent_last_recorded_at: now,
    };
    if (firstName) {
      fanUpdates.first_name = firstName;
      fanUpdates.name = firstName;
    }
    const { error } = await supabase.from("fans").update(fanUpdates).eq("workspace_id", link.workspaceId).eq("id", fanId);
    if (error) throw error;
  } else {
    const { data: createdFan, error: createError } = await supabase
      .from("fans")
      .insert({
        workspace_id: link.workspaceId,
        email,
        name: firstName || null,
        first_name: firstName || null,
        segment: "smart_link",
        consent_status: "subscribed",
        consent_source: `artistos_link:${link.slug}`,
        first_seen: now.slice(0, 10),
        verification_status: "unverified",
        source_smart_link_id: link.id,
        last_seen_at: now,
        consent_last_recorded_at: now,
      })
      .select("id")
      .single();

    if (createError?.code === "23505") {
      const { data: racedFan, error: racedFanError } = await supabase
        .from("fans")
        .select("id")
        .eq("workspace_id", link.workspaceId)
        .ilike("email", email)
        .is("archived_at", null)
        .single();
      if (racedFanError) throw racedFanError;
      fanId = racedFan.id;
      const { error: updateError } = await supabase
        .from("fans")
        .update({
          consent_status: "subscribed",
          consent_source: `artistos_link:${link.slug}`,
          source_smart_link_id: link.id,
          last_seen_at: now,
          consent_last_recorded_at: now,
        })
        .eq("workspace_id", link.workspaceId)
        .eq("id", fanId);
      if (updateError) throw updateError;
    } else if (createError) {
      throw createError;
    } else {
      fanId = createdFan.id;
    }
  }

  if (!fanId) throw new Error("fan_capture_failed");

  const sourceUrl = `/l/${link.slug}`;
  const commonEvidence = {
    form_version: "artistos-public-link-v1",
    release_id: link.releaseId,
    smart_link_slug: link.slug,
    email_confirmation_status: "unverified",
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
  };
  const { error: consentError } = await supabase.from("fan_consents").insert([
    {
      workspace_id: link.workspaceId,
      fan_id: fanId,
      smart_link_id: link.id,
      consent_type: "email_marketing",
      granted: true,
      policy_version: link.consentCopyVersion,
      source_url: sourceUrl,
      evidence: { ...commonEvidence, action: "email_updates_checked" },
      recorded_at: now,
    },
    {
      workspace_id: link.workspaceId,
      fan_id: fanId,
      smart_link_id: link.id,
      consent_type: "privacy_terms",
      granted: true,
      policy_version: link.consentCopyVersion,
      source_url: sourceUrl,
      evidence: { ...commonEvidence, action: "privacy_notice_acknowledged" },
      recorded_at: now,
    },
  ]);
  if (consentError) throw consentError;

  await recordPublicLinkEvent({
    link,
    eventType: "fan_signup",
    fanId,
    utmSource,
    utmMedium,
    utmCampaign,
    metadata: { collection_version: "public-link-fan-v1", email_confirmation_status: "unverified" },
  });

  redirect(`/l/${encodeURIComponent(link.slug)}?signup=success`);
}
