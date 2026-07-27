import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTaskCapability,
  getActiveWorkspaceCapability,
  getArtistCapability,
  getReleaseCapability,
  listArtistsCapability,
  listReleasesCapability,
  suppressAudienceCapability,
  updateTaskStatusCapability,
} from "./initial-registry";
import { registerCapabilityHandler } from "./handlers";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

registerCapabilityHandler(getActiveWorkspaceCapability, async ({ ctx }) => ({
  output: { workspaceId: ctx.workspaceId, role: ctx.role },
  evidenceIds: [],
}));

registerCapabilityHandler(listArtistsCapability, async ({ ctx, input }) => {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("artists")
    .select("id,name,aliases")
    .eq("workspace_id", ctx.workspaceId)
    .order("name");
  if (!input.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return { output: { artists: data ?? [] }, evidenceIds: [] };
});

registerCapabilityHandler(getArtistCapability, async ({ ctx, input }) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("artists")
    .select("id,name,aliases,bio")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("artist_not_found");
  return { output: data, evidenceIds: [] };
});

registerCapabilityHandler(listReleasesCapability, async ({ ctx, input }) => {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("releases")
    .select("id,artist_id,title,status,release_date")
    .eq("workspace_id", ctx.workspaceId)
    .order("release_date", { ascending: false })
    .limit(input.limit);
  if (input.artistId) query = query.eq("artist_id", input.artistId);
  const { data, error } = await query;
  if (error) throw error;
  return {
    output: {
      releases: (data ?? []).map((release) => ({
        id: release.id,
        artistId: release.artist_id,
        title: release.title,
        status: release.status,
        releaseDate: release.release_date,
      })),
    },
    evidenceIds: [],
  };
});

registerCapabilityHandler(getReleaseCapability, async ({ ctx, input }) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("releases")
    .select("id,artist_id,title,status,release_date")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.releaseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("release_not_found");
  return {
    output: {
      id: data.id,
      artistId: data.artist_id,
      title: data.title,
      status: data.status,
      releaseDate: data.release_date,
    },
    evidenceIds: [],
  };
});

registerCapabilityHandler(createTaskCapability, async ({ ctx, input, idempotencyKey }) => {
  const supabase = await createSupabaseServerClient();
  if (input.releaseId) {
    const { data: release, error: releaseError } = await supabase
      .from("releases")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", input.releaseId)
      .maybeSingle();
    if (releaseError) throw releaseError;
    if (!release) throw new Error("release_not_found");
  }
  const { data: existing, error: existingError } = await supabase
    .from("tasks")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("idempotency_key", idempotencyKey ?? input.idempotencyKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { output: { taskId: existing.id, created: false }, evidenceIds: [] };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: ctx.workspaceId,
      release_id: input.releaseId ?? null,
      title: input.title,
      detail: input.detail ?? null,
      due_date: input.dueDate ?? null,
      status: "open",
      classification: "capability",
      idempotency_key: idempotencyKey ?? input.idempotencyKey,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { output: { taskId: data.id, created: true }, evidenceIds: [] };
});

registerCapabilityHandler(updateTaskStatusCapability, async ({ ctx, input }) => {
  const supabase = await createSupabaseServerClient();
  const { data: current, error: currentError } = await supabase
    .from("tasks")
    .select("id,status")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.taskId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error("task_not_found");
  if (current.status === input.status) {
    return { output: { taskId: current.id, status: current.status, changed: false }, evidenceIds: [] };
  }
  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: input.status,
      completed_at: input.status === "done" ? new Date().toISOString() : null,
    })
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.taskId)
    .select("id,status")
    .single();
  if (error) throw error;
  return { output: { taskId: data.id, status: data.status, changed: true }, evidenceIds: [] };
});

registerCapabilityHandler(suppressAudienceCapability, async ({ ctx, input }) => {
  const supabase = await createSupabaseServerClient();
  const email = normalizeEmail(input.email);
  const { data: existing, error: existingError } = await supabase
    .from("suppressions")
    .select("id,email")
    .eq("workspace_id", ctx.workspaceId)
    .eq("normalized_email", email)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    return { output: { suppressionId: existing.id, email, alreadySuppressed: true }, evidenceIds: [] };
  }
  const { data, error } = await supabase
    .from("suppressions")
    .insert({
      workspace_id: ctx.workspaceId,
      email,
      normalized_email: email,
      reason: input.notes ? `${input.reasonCode}: ${input.notes}` : input.reasonCode,
      reason_code: input.reasonCode,
      notes: input.notes ?? null,
      source: input.source,
      suppressed_by: ctx.userId,
      suppressed_at: new Date().toISOString().slice(0, 10),
    })
    .select("id,email")
    .single();
  if (error) throw error;
  return { output: { suppressionId: data.id, email, alreadySuppressed: false }, evidenceIds: [] };
});
