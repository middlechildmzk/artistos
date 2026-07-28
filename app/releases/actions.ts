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

export async function createRelease(formData: FormData) {
  const artistId = String(formData.get("artistId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!artistId || !title) return;
  await invoke("releases.create", { artistId, title, featuredArtist: String(formData.get("featuredArtist") ?? "").trim() || null, releaseDate: String(formData.get("releaseDate") ?? "") || null, distributor: String(formData.get("distributor") ?? "").trim() || null, label: String(formData.get("label") ?? "").trim() || null, idempotencyKey: `release-create:${artistId}:${randomUUID()}` });
  revalidatePath("/releases");
  revalidatePath("/dashboard");
}

export async function updateRelease(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!releaseId || !title) return;
  await invoke("releases.update", { releaseId, title, featuredArtist: String(formData.get("featuredArtist") ?? "").trim() || null, releaseDate: String(formData.get("releaseDate") ?? "") || null, distributor: String(formData.get("distributor") ?? "").trim() || null, label: String(formData.get("label") ?? "").trim() || null, isrc: String(formData.get("isrc") ?? "").trim() || null, upc: String(formData.get("upc") ?? "").trim() || null, spotifyUrl: String(formData.get("spotifyUrl") ?? "").trim() || null, status: String(formData.get("status") ?? "upcoming"), notes: String(formData.get("notes") ?? "").trim() || null, idempotencyKey: `release-update:${releaseId}:${randomUUID()}` });
  revalidatePath("/releases");
  revalidatePath("/dashboard");
}

export async function addReleaseAsset(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!releaseId || !name) return;
  await invoke("releases.add_asset", { releaseId, name, assetType: String(formData.get("assetType") ?? "other"), url: String(formData.get("url") ?? "").trim() || null, locationNote: String(formData.get("locationNote") ?? "").trim() || null, status: String(formData.get("status") ?? "ready"), idempotencyKey: `release-asset:${releaseId}:${randomUUID()}` });
  revalidatePath("/releases");
}

export async function createReleaseCampaign(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!releaseId || !name) return;
  await invoke("releases.create_campaign", { releaseId, name, startDate: String(formData.get("startDate") ?? "") || null, endDate: String(formData.get("endDate") ?? "") || null, goals: String(formData.get("goals") ?? "").trim() || null, idempotencyKey: `release-campaign:${releaseId}:${randomUUID()}` });
  revalidatePath("/releases");
  revalidatePath("/campaigns");
}