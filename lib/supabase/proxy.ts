import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseConfig();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
        items.forEach(({ name, value }: { name: string; value: string }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && !path.startsWith('/login') && !path.startsWith('/auth') && !path.startsWith('/api/oauth')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }
  if (user && path === '/login') {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = '/';
    return NextResponse.redirect(appUrl);
  }
  return response;
}
