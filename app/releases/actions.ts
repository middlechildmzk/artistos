"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireWorkspace() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (error || !membership) throw new Error("No active workspace membership found");
  return { supabase, workspaceId: membership.workspace_id };
}

export async function createRelease(formData: FormData) {
  const artistId = String(formData.get("artistId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const featuredArtist = String(formData.get("featuredArtist") ?? "").trim() || null;
  const releaseDate = String(formData.get("releaseDate") ?? "") || null;
  const distributor = String(formData.get("distributor") ?? "").trim() || null;
  const label = String(formData.get("label") ?? "").trim() || null;
  if (!artistId || !title) return;

  const { supabase, workspaceId } = await requireWorkspace();
  const { data: artist, error: artistError } = await supabase.from("artists").select("id").eq("id", artistId).eq("workspace_id", workspaceId).maybeSingle();
  if (artistError || !artist) throw new Error("Artist not found in this workspace");

  const { data: release, error } = await supabase.from("releases").insert({
    workspace_id: workspaceId,
    artist_id: artistId,
    title,
    featured_artist: featuredArtist,
    release_date: releaseDate,
    distributor,
    label,
    status: releaseDate ? "upcoming" : "draft",
  }).select("id").single();
  if (error) throw error;

  const starterTasks = [
    ["Confirm master audio", "Verify final mix, master format, loudness, and filename."],
    ["Finalize original artwork", "Confirm store-safe square artwork and ownership."],
    ["Lock metadata", "Verify artist styling, title, featured artist, label, ISRC, UPC, and release date."],
    ["Prepare platform pitch", "Draft the editorial pitch, genres, moods, instruments, and campaign story."],
    ["Build release campaign", "Create the target list, outreach plan, content schedule, and follow-up rhythm."],
  ];
  const { error: taskError } = await supabase.from("tasks").insert(starterTasks.map(([taskTitle, detail], index) => ({ workspace_id: workspaceId, release_id: release.id, title: taskTitle, detail, classification: "spine", status: "open", sort_order: (index + 1) * 10 })));
  if (taskError) throw taskError;

  revalidatePath("/releases");
  revalidatePath("/dashboard");
}

export async function updateRelease(formData: FormData) {
  const releaseId = String(formData.get("releaseId") ?? "");
  if (!releaseId) return;
  const payload = {
    title: String(formData.get("title") ?? "").trim(),
    featured_artist: String(formData.get("featuredArtist") ?? "").trim() || null,
    release_date: String(formData.get("releaseDate") ?? "") || null,
    distributor: String(formData.get("distributor") ?? "").trim() || null,
    label: String(formData.get("label") ?? "").trim() || null,
    isrc: String(formData.get("isrc") ?? "").trim() || null,
    upc: String(formData.get("upc") ?? "").trim() || null,
    spotify_url: String(formData.get("spotifyUrl") ?? "").trim() || null,
    status: String(formData.get("status") ?? "upcoming"),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
  if (!payload.title) return;
  const allowedStatuses = new Set(["draft", "upcoming", "released", "paused", "archived"]);
  if (!allowedStatuses.has(payload.status)) throw new Error("Unsupported release status");

  const { supabase, workspaceId } = await requireWorkspace();
  const { error } = await supabase.from("releases").update(payload).eq("id", releaseId).eq("workspace_id", workspaceId);
  if (error) throw error;
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
  const startDate = String(formData.get("startDate") ?? "") || null;
  const endDate = String(formData.get("endDate") ?? "") || null;
  const goals = String(formData.get("goals") ?? "").trim() || null;
  if (!releaseId || !name) return;

  const { supabase, workspaceId } = await requireWorkspace();
  const { data: release, error: releaseError } = await supabase.from("releases").select("id").eq("id", releaseId).eq("workspace_id", workspaceId).maybeSingle();
  if (releaseError || !release) throw new Error("Release not found");

  const { error } = await supabase.from("campaigns").insert({ workspace_id: workspaceId, release_id: releaseId, name, status: "active", start_date: startDate, end_date: endDate, goals });
  if (error) throw error;
  revalidatePath("/releases");
  revalidatePath("/campaigns");
}
