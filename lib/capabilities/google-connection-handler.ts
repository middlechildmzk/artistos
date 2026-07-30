import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptIntegrationToken } from "@/lib/integrations/token-crypto";
import { registerCapabilityHandler } from "./handlers";
import { connectGoogleAccountCapability } from "./integrations-registry";

function requireUserId(value: string | null) {
  if (!value) throw new Error("user_context_required");
  return value;
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

registerCapabilityHandler(connectGoogleAccountCapability, async ({ ctx, input, idempotencyKey }) => {
  const userId = requireUserId(ctx.userId);
  const key = idempotencyKey ?? input.idempotencyKey;
  const supabase = await createSupabaseServerClient();

  const { data: replay, error: replayError } = await supabase
    .from("capability_idempotency")
    .select("result")
    .eq("workspace_id", ctx.workspaceId)
    .eq("capability_name", connectGoogleAccountCapability.name)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (replayError) throw replayError;
  if (replay?.result && typeof replay.result === "object" && "connectionId" in replay.result) {
    return { output: replay.result as any, evidenceIds: [] };
  }

  const { data: existing, error: existingError } = await supabase
    .from("oauth_connections")
    .select("metadata")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (existingError) throw existingError;

  const connectedAt = new Date().toISOString();
  const { data: connection, error: upsertError } = await supabase
    .from("oauth_connections")
    .upsert({
      workspace_id: ctx.workspaceId,
      user_id: userId,
      provider: "google",
      provider_account_id: input.providerAccountId ?? null,
      account_email: input.accountEmail ?? null,
      encrypted_access_token: encryptIntegrationToken(input.accessToken),
      encrypted_refresh_token: encryptIntegrationToken(input.refreshToken),
      token_type: input.tokenType,
      expires_at: input.expiresAt,
      scopes: input.scopes,
      metadata: {
        ...metadataObject(existing?.metadata),
        email_verified: input.emailVerified ?? null,
        connection_status: "connected_pending_sync",
        reconnected_at: connectedAt,
        youtube_error: null,
      },
      last_error: null,
      updated_at: connectedAt,
    }, { onConflict: "user_id,provider" })
    .select("id")
    .single();
  if (upsertError) throw upsertError;

  const result = { connectionId: connection.id, connected: true as const };
  const { error: receiptError } = await supabase.from("capability_idempotency").insert({
    workspace_id: ctx.workspaceId,
    capability_name: connectGoogleAccountCapability.name,
    capability_version: 1,
    idempotency_key: key,
    input_hash: key,
    result,
    created_by: userId,
  });
  if (receiptError) throw receiptError;
  return { output: result, evidenceIds: [] };
});
