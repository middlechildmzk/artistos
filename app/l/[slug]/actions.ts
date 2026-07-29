"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { invokeCapability } from "@/lib/capabilities/invoke";
import {
  createPublicLinkActorContext,
  createPublicLinkInvocationDependencies,
} from "@/lib/capabilities/public-links-runtime";
import { cleanPublicText, loadPublicLink } from "@/lib/public-links";

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

  const utmSource = cleanPublicText(formData.get("utmSource"), 160) || null;
  const utmMedium = cleanPublicText(formData.get("utmMedium"), 160) || null;
  const utmCampaign = cleanPublicText(formData.get("utmCampaign"), 160) || null;
  const identityHash = createHash("sha256").update(`${link.id}:${email}`).digest("hex").slice(0, 24);
  const idempotencyKey = `public-fan:${identityHash}:${new Date().toISOString().slice(0, 10)}`;
  const ctx = createPublicLinkActorContext(link);
  const result = await invokeCapability({
    name: "public_links.capture_fan",
    ctx,
    input: {
      linkId: link.id,
      email,
      firstName: firstName || null,
      utmSource,
      utmMedium,
      utmCampaign,
      emailConsent: true,
      privacyAcknowledged: true,
      idempotencyKey,
    },
    idempotencyKey,
    dependencies: createPublicLinkInvocationDependencies(link),
  });

  if (result.status !== "ok") {
    redirect(`/l/${encodeURIComponent(link.slug)}?signup=error`);
  }
  redirect(`/l/${encodeURIComponent(link.slug)}?signup=success`);
}
