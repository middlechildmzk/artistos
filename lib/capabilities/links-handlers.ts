import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "./handlers";
import { saveSmartLinkCapability, saveSmartLinkDestinationCapability } from "./links-registry";

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

async function writeReplay(args: {
  workspaceId: string;
  capabilityName: string;
  capabilityVersion: number;
  key: string;
  result: unknown;
  userId?: string | null;
}) {
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

registerCapabilityHandler(saveSmartLinkCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, saveSmartLinkCapability.name, key);
  if (replay && typeof replay === "object" && "smartLinkId" in replay) {
    return { output: replay as any, evidenceIds: [] };
  }
  if (!ctx.userId) throw new Error("not_authenticated");

  const supabase = await createSupabaseServerClient();
  const [{ data: release, error: releaseError }, { data: existing, error: existingError }, { data: slugOwner, error: slugError }] = await Promise.all([
    supabase.from("releases").select("id").eq("workspace_id", ctx.workspaceId).eq("id", input.releaseId).maybeSingle(),
    supabase.from("smart_links").select("id,slug").eq("workspace_id", ctx.workspaceId).eq("release_id", input.releaseId).maybeSingle(),
    supabase.from("smart_links").select("id,release_id").eq("slug", input.slug).maybeSingle(),
  ]);
  if (releaseError) throw releaseError;
  if (existingError) throw existingError;
  if (slugError) throw slugError;
  if (!release) throw new Error("release_not_found");
  if (slugOwner && slugOwner.id !== existing?.id) throw new Error("slug_taken");

  const values = {
    workspace_id: ctx.workspaceId,
    owner_id: ctx.userId,
    release_id: input.releaseId,
    slug: input.slug,
    mode: input.mode,
    headline: input.headline ?? null,
    description: input.description ?? null,
    capture_email: input.captureEmail,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  };

  let smartLinkId = existing?.id;
  let created = false;
  if (smartLinkId) {
    const { error } = await supabase.from("smart_links").update(values).eq("workspace_id", ctx.workspaceId).eq("id", smartLinkId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("smart_links").insert(values).select("id").single();
    if (error) throw error;
    smartLinkId = data.id;
    created = true;
  }

  const result = { smartLinkId, releaseId: input.releaseId, slug: input.slug, created };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: saveSmartLinkCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});

registerCapabilityHandler(saveSmartLinkDestinationCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, saveSmartLinkDestinationCapability.name, key);
  if (replay && typeof replay === "object" && "destinationId" in replay) {
    return { output: replay as any, evidenceIds: [] };
  }

  const supabase = await createSupabaseServerClient();
  const { data: smartLink, error: smartLinkError } = await supabase
    .from("smart_links")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.smartLinkId)
    .maybeSingle();
  if (smartLinkError) throw smartLinkError;
  if (!smartLink) throw new Error("smart_link_not_found");

  const normalizedService = input.service.trim().toLowerCase();
  const { data: existing, error: existingError } = await supabase
    .from("smart_link_destinations")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("smart_link_id", input.smartLinkId)
    .eq("service", normalizedService)
    .maybeSingle();
  if (existingError) throw existingError;

  const values = {
    workspace_id: ctx.workspaceId,
    smart_link_id: input.smartLinkId,
    service: normalizedService,
    url: input.url,
    position: input.position,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  };

  let destinationId = existing?.id;
  let created = false;
  if (destinationId) {
    const { error } = await supabase.from("smart_link_destinations").update(values).eq("workspace_id", ctx.workspaceId).eq("id", destinationId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("smart_link_destinations").insert(values).select("id").single();
    if (error) throw error;
    destinationId = data.id;
    created = true;
  }

  const result = { destinationId, smartLinkId: input.smartLinkId, service: normalizedService, created };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: saveSmartLinkDestinationCapability.name, capabilityVersion: 1, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: [] };
});
