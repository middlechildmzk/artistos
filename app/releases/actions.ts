"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

async function invoke(name: string, input: Record<string, unknown>) {
  const ctx = await createActorContext();
  const idempotencyKey = String(input.idempotencyKey);
  const result = await invokeCapability({ name, ctx, input, idempotencyKey, dependencies: createServerInvocationDependencies() });
  if (result.status !== "ok") throw new Error(result.status === "failed" ? result.error.message : `Capability ${result.status}`);
}

async function requireWorkspace() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership, error } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (error || !membership) throw new Error("No active workspace membership found");
  return { supabase, workspaceId: membership.workspace_id };
}

export async function createRelease(formData: FormData) {
  const artistId = String(formData.get("artistId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!artistId || !title) return;
  const idempotencyKey = `release-create:${artistId}:${randomUUID()}`;
  await invoke("releases.create", {
    artistId,
    title,
    featuredArtist: String(formData.get("featuredArtist") ?? "").trim() || null,
    releaseDate: String(formData.get("releaseDate") ?? "") || null,
    distributor: String(formData.get("distributor") ?? "").trim() || null,
    label: String(formData.get("label") ?? "").trim() || null,
    idempotencyKey,
  });
  revalidatePath("/releases");
  revalidatePath("/dashboard");
}

export async function updateRelease(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!releaseId || !title) return;
  const idempotencyKey = `release-update:${releaseId}:${randomUUID()}`;
  await invoke("releases.update", {
    releaseId,
    title,
    featuredArtist: String(formData.get("featuredArtist") ?? "").trim() || null,
    releaseDate: String(formData.get("releaseDate") ?? "") || null,
    distributor: String(formData.get("distributor") ?? "").trim() || null,
    label: String(formData.get("label") ?? "").trim() || null,
    isrc: String(formData.get("isrc") ?? "").trim() || null,
    upc: String(formData.get("upc") ?? "").trim() || null,
    spotifyUrl: String(formData.get("spotifyUrl") ?? "").trim() || null,
    status: String(formData.get("status") ?? "upcoming"),
    notes: String(formData.get("notes") ?? "").trim() || null,
    idempotencyKey,
  });
  revalidatePath("/releases");
  revalidatePath("/dashboard");
}

export async function addReleaseAsset(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const assetType = String(formData.get("assetType") ?? "other");
  const url = String(formData.get("url") ?? "").trim() || null;
  const locationNote = String(formData.get("locationNote") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "ready");
  if (!releaseId || !name) return;
  const { supabase, workspaceId } = await requireWorkspace();
  const { data: release, error: releaseError } = await supabase.from("releases").select("id, artist_id").eq("id", releaseId).eq("workspace_id", workspaceId).maybeSingle();
  if (releaseError || !release) throw new Error("Release not found");
  const { error } = await supabase.from("assets").insert({ workspace_id: workspaceId, release_id: releaseId, artist_id: release.artist_id, name, asset_type: assetType, url, location_note: locationNote, status });
  if (error) throw error;
  revalidatePath("/releases");
}

export async function createReleaseCampaign(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!releaseId || !name) return;
  const { supabase, workspaceId } = await requireWorkspace();
  const { data: release, error: releaseError } = await supabase.from("releases").select("id").eq("id", releaseId).eq("workspace_id", workspaceId).maybeSingle();
  if (releaseError || !release) throw new Error("Release not found");
  const { error } = await supabase.from("campaigns").insert({ workspace_id: workspaceId, release_id: releaseId, name, status: "active", start_date: String(formData.get("startDate") ?? "") || null, end_date: String(formData.get("endDate") ?? "") || null, goals: String(formData.get("goals") ?? "").trim() || null });
  if (error) throw error;
  revalidatePath("/releases");
  revalidatePath("/campaigns");
}