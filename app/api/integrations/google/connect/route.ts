import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildGoogleAuthorizationUrl } from "@/lib/integrations/google";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const state = randomBytes(24).toString("base64url");
    const authorizationUrl = buildGoogleAuthorizationUrl(request.nextUrl.origin, state);
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set("artistos_google_oauth_state", state, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_oauth_unavailable";
    return NextResponse.redirect(new URL(`/connections?error=${encodeURIComponent(message)}`, request.url));
  }
}
