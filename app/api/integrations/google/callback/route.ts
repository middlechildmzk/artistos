import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    const token = await exchangeGoogleAuthorizationCode(request.nextUrl.origin, code);
    const accessToken = token.access_token;
    const refreshToken = token.refresh_token;
    if (!accessToken) throw new Error("google_access_token_missing");
    if (!refreshToken) throw new Error("google_refresh_token_missing_reconnect_with_consent");
    const userInfo = await getGoogleUserInfo(accessToken);
    const expiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString();
    const idempotencyKey = `google-connect:${createHash("sha256").update(code).digest("hex")}`;
    const ctx = await createActorContext();
    const result = await invokeCapability({
      name: "integrations.connect_google_account",
      ctx,
      input: {
        providerAccountId: userInfo.sub ?? null,
        accountEmail: userInfo.email ?? auth.user.email ?? null,
        accessToken,
        refreshToken,
        tokenType: token.token_type ?? "Bearer",
        expiresAt,
        scopes: token.scope?.split(" ").filter(Boolean) ?? [],
        emailVerified: userInfo.email_verified ?? null,
        idempotencyKey,
      },
      idempotencyKey,
      dependencies: createServerInvocationDependencies(),
    });
    if (result.status === "requires_approval") throw new Error(`approval_required:${result.approvalId}`);
    if (result.status === "denied") throw new Error(`capability_denied:${result.policy}:${result.reason}`);
    if (result.status === "failed") throw new Error(`${result.error.code}:${result.error.message}`);

    const response = NextResponse.redirect(new URL("/connections?connected=google", request.url));
    response.cookies.delete("artistos_google_oauth_state");
    return response;
  } catch (error) {
    return redirectWithError(request, error);
  }
}
