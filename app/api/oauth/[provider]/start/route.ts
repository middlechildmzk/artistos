import { NextRequest, NextResponse } from 'next/server';
import { authorizationUrl, pkce, type Provider } from '@/lib/oauth';

function providerFrom(value: string): Provider | null {
  return value === 'google' || value === 'spotify' ? value : null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = providerFrom(rawProvider);
  if (!provider) return NextResponse.json({ error: 'Unsupported OAuth provider.' }, { status: 404 });
  try {
    const origin = new URL(request.url).origin;
    const session = pkce();
    const response = NextResponse.redirect(authorizationUrl(provider, origin, session.state, session.challenge));
    response.cookies.set(`artistos_oauth_${provider}`, JSON.stringify({ state: session.state, verifier: session.verifier }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth could not start.';
    return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(message)}`, request.url));
  }
}
