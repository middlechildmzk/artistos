"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";
import { parseMusicDestinationUrls } from "@/lib/smart-links/services";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function invoke(name: string, input: Record<string, unknown>) {
  const ctx = await createActorContext();
  const idempotencyKey = String(input.idempotencyKey);
  const result = await invokeCapability({
    name,
    ctx,
    input,
    idempotencyKey,
    dependencies: createServerInvocationDependencies(),
  });
  if (result.status !== "ok") {
    throw new Error(result.status === "failed" ? result.error.message : `Capability ${result.status}`);
  }
}

export async function saveSmartLink(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  if (!releaseId || slug.length < 3) return;

  await invoke("links.save", {
    releaseId,
    slug,
    mode: String(formData.get("mode") ?? "live"),
    headline: String(formData.get("headline") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    captureEmail: formData.get("captureEmail") === "on",
    isActive: formData.get("isActive") === "on",
    idempotencyKey: `links-save:${releaseId}:${randomUUID()}`,
  });

  revalidatePath("/links");
  revalidatePath("/releases");
  revalidatePath("/dashboard");
}

export async function saveSmartLinkDestination(formData: FormData) {
  const smartLinkId = String(formData.get("smartLinkId") ?? "");
  const service = String(formData.get("service") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!smartLinkId || !service || !url) return;

  await invoke("links.save_destination", {
    smartLinkId,
    service,
    url,
    position: Number.parseInt(String(formData.get("position") ?? "0"), 10) || 0,
    isActive: formData.get("isActive") === "on",
    idempotencyKey: `links-destination:${smartLinkId}:${service.toLowerCase()}:${randomUUID()}`,
  });

  revalidatePath("/links");
  revalidatePath("/releases");
}

export async function saveSmartLinkDestinations(formData: FormData) {
  const smartLinkId = String(formData.get("smartLinkId") ?? "");
  const destinations = parseMusicDestinationUrls(String(formData.get("urls") ?? ""));
  if (!smartLinkId || !destinations.length) return;

  const onePerService = Array.from(new Map(destinations.map((destination) => [destination.service, destination])).values());
  await Promise.all(onePerService.map((destination, index) => invoke("links.save_destination", {
    smartLinkId,
    service: destination.service,
    url: destination.url,
    position: index,
    isActive: true,
    idempotencyKey: "links-destination-bulk:" + smartLinkId + ":" + destination.service + ":" + randomUUID(),
  })));

  revalidatePath("/links");
  revalidatePath("/releases");
  revalidatePath("/dashboard");
}
