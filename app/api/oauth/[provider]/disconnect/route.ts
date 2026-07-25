import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== 'google' && provider !== 'spotify') return NextResponse.json({ error: 'Unsupported provider.' }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { error } = await supabase.from('oauth_connections').delete().eq('user_id', user.id).eq('provider', provider);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.redirect(new URL('/integrations?disconnected=' + provider, request.url), 303);
}
