import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptIntegrationToken } from "@/lib/integrations/token-crypto";
import { exchangeGoogleAuthorizationCode, getGoogleUserInfo } from "@/lib/integrations/google";

function redirectWithError(request: NextRequest, error: unknown) {
  const message = error instanceof Error ? error.message : "google_oauth_failed";
  const response = NextResponse.redirect(new URL(`/connections?error=${encodeURIComponent(message.slice(0, 240))}`, request.url));
  response.cookies.delete("artistos_google_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) return redirectWithError(request, providerError);

  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("artistos_google_oauth_state")?.value;
  const code = request.nextUrl.searchParams.get("code");
  if (!state || !expectedState || state !== expectedState) return redirectWithError(request, "invalid_google_oauth_state");
  if (!code) return redirectWithError(request, "google_authorization_code_missing");

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) throw new Error("workspace_not_found");

    const token = await exchangeGoogleAuthorizationCode(request.nextUrl.origin, code);
    const userInfo = await getGoogleUserInfo(token.access_token as string);
    const { data: existing, error: existingError } = await supabase
      .from("oauth_connections")
      .select("metadata,encrypted_refresh_token")
      .eq("user_id", auth.user.id)
      .eq("provider", "google")
      .maybeSingle();
    if (existingError) throw existingError;

    const refreshToken = token.refresh_token;
    if (!refreshToken) throw new Error("google_refresh_token_missing_reconnect_with_consent");
    const expiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString();
    const metadata = {
      ...(existing?.metadata ?? {}),
      email_verified: userInfo.email_verified ?? null,
      connection_status: "connected_pending_sync",
      reconnected_at: new Date().toISOString(),
      youtube_error: null,
    };

    const { error: upsertError } = await supabase.from("oauth_connections").upsert({
      workspace_id: membership.workspace_id,
      user_id: auth.user.id,
      provider: "google",
      provider_account_id: userInfo.sub ?? null,
      account_email: userInfo.email ?? auth.user.email ?? null,
      encrypted_access_token: encryptIntegrationToken(token.access_token as string),
      encrypted_refresh_token: encryptIntegrationToken(refreshToken),
      token_type: token.token_type ?? "Bearer",
      expires_at: expiresAt,
      scopes: token.scope?.split(" ").filter(Boolean) ?? [],
      metadata,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    if (upsertError) throw upsertError;

    const response = NextResponse.redirect(new URL("/connections?connected=google", request.url));
    response.cookies.delete("artistos_google_oauth_state");
    return response;
  } catch (error) {
    return redirectWithError(request, error);
  }
}
