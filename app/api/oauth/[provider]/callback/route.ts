import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, fetchIdentity, saveConnection, type Provider } from '@/lib/oauth';

function providerFrom(value: string): Provider | null {
  return value === 'google' || value === 'spotify' ? value : null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = providerFrom(rawProvider);
  if (!provider) return NextResponse.json({ error: 'Unsupported OAuth provider.' }, { status: 404 });
  const destination = new URL('/integrations', request.url);
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const providerError = request.nextUrl.searchParams.get('error');
    if (providerError) throw new Error(`Authorization was not completed: ${providerError}`);
    if (!code || !state) throw new Error('OAuth callback is missing code or state.');
    const rawCookie = request.cookies.get(`artistos_oauth_${provider}`)?.value;
    if (!rawCookie) throw new Error('OAuth session expired. Start the connection again.');
    const saved = JSON.parse(rawCookie) as { state?: string; verifier?: string };
    if (!saved.state || !saved.verifier || saved.state !== state) throw new Error('OAuth state validation failed.');
    const origin = new URL(request.url).origin;
    const token = await exchangeCode(provider, origin, code, saved.verifier);
    const identity = await fetchIdentity(provider, token.access_token);
    await saveConnection(provider, token, identity);
    destination.searchParams.set('connected', provider);
  } catch (error) {
    destination.searchParams.set('error', error instanceof Error ? error.message : 'OAuth callback failed.');
  }
  const response = NextResponse.redirect(destination);
  response.cookies.delete(`artistos_oauth_${provider}`);
  return response;
}
