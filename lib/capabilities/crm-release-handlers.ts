import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import {
  createReleaseCapability,
  updateOrganizationRelationshipCapability,
  updateReleaseCapability,
} from "./crm-release-registry";

async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("capability_idempotency")
    .select("result")
    .eq("workspace_id", workspaceId)
    .eq("capability_name", capabilityName)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

async function writeReplay(args: { workspaceId: string; capabilityName: string; capabilityVersion: number; key: string; result: unknown; userId?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({
    workspace_id: args.workspaceId,
    capability_name: args.capabilityName,
    capability_version: args.capabilityVersion,
    idempotency_key: args.key,
    input_hash: args.key,
    result: args.result,
    created_by: args.userId ?? null,
  });
  if (error) throw error;
}

registerCapabilityHandler(updateOrganizationRelationshipCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, updateOrganizationRelationshipCapability.name, key);
  if (replay && typeof replay === "object" && "organizationId" in replay) return { output: replay as any, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const { data: current, error: currentError } = await supabase
    .from("organizations")
    .select("id,relationship_stage,next_action,next_action_due")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.organizationId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error("organization_not_found");

  const changed = current.relationship_stage !== input.relationshipStage || current.next_action !== (input.nextAction ?? null) || current.next_action_due !== (input.nextActionDue ?? null);
  if (changed) {
    const { error } = await supabase
      .from("organizations")
      .update({ relationship_stage: input.relationshipStage, next_action: input.nextAction ?? null, next_action_due: input.nextActionDue ?? null })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", input.organizationId);
    if (error) throw error;
  }
  const result = { organizationId: input.organizationId, relationshipStage: input.relationshipStage, changed };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: updateOrganizationRelationshipCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(createReleaseCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, createReleaseCapability.name, key);
  if (replay && typeof replay === "object" && "releaseId" in replay) return { output: replay as any, evidenceIds: [] };

  const supabase = await createSupabaseServerClient();
  const { data: artist, error: artistError } = await supabase.from("artists").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.artistId).maybeSingle();
  if (artistError) throw artistError;
  if (!artist) throw new Error("artist_not_found");

  const { data: release, error } = await supabase.from("releases").insert({
    workspace_id: ctx.workspaceId,
    artist_id: input.artistId,
    title: input.title,
    featured_artist: input.featuredArtist ?? null,
    release_date: input.releaseDate ?? null,
    distributor: input.distributor ?? null,
    label: input.label ?? null,
    status: input.releaseDate ? "upcoming" : "draft",
  }).select("id").single();
  if (error) throw error;

  const starterTasks = [
    ["Confirm master audio", "Verify final mix, master format, loudness, and filename."],
    ["Finalize original artwork", "Confirm store-safe square artwork and ownership."],
    ["Lock metadata", "Verify artist styling, title, featured artist, label, ISRC, UPC, and release date."],
    ["Prepare platform pitch", "Draft the editorial pitch, genres, moods, instruments, and campaign story."],
    ["Build release campaign", "Create the target list, outreach plan, content schedule, and follow-up rhythm."],
  ];
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

  const { error } = await supabase.from("releases").update({
    title: input.title,
    featured_artist: input.featuredArtist ?? null,
    release_date: input.releaseDate ?? null,
    distributor: input.distributor ?? null,
    label: input.label ?? null,
    isrc: input.isrc ?? null,
    upc: input.upc ?? null,
    spotify_url: input.spotifyUrl ?? null,
    status: input.status,
    notes: input.notes ?? null,
  }).eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId);
  if (error) throw error;
  const result = { releaseId: input.releaseId, status: input.status, changed: true };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: updateReleaseCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});