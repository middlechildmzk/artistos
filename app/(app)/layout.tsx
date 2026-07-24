import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/actions';
import { Sidebar } from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return (
    <div className="shell">
      <Sidebar email={user.email ?? 'ArtistOS user'} />
      <main className="main">
        <div className="row between" style={{marginBottom:18}}>
          <span className="badge green">Live data · protected workspace</span>
          <form action={signOut}><button className="button ghost" type="submit">Sign out</button></form>
        </div>
        {children}
      </main>
    </div>
  );
}
