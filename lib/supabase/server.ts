import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are missing.');
  return { url, key };
}

export async function createClient() {
  const { url, key } = config();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
        try {
          items.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always write cookies. proxy.ts refreshes sessions.
        }
      },
    },
  });
}
