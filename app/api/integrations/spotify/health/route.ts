import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/oauth';

export async function GET() {
  try {
    const accessToken = await getValidAccessToken('spotify');
    const response = await fetch('https://api.spotify.com/v1/me', { headers: { authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    const profile = await response.json();
    if (!response.ok) throw new Error(profile.error?.message || 'Spotify profile test failed.');
    return NextResponse.json({ connected: true, id: profile.id, displayName: profile.display_name, email: profile.email ?? null, country: profile.country ?? null });
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : 'Spotify health test failed.' }, { status: 503 });
  }
}
