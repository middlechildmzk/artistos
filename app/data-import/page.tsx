import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ImportWizard } from '@/components/import-wizard';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspace } from '@/lib/workspace';

export default async function DataImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const workspace = await getActiveWorkspace();

  return <main style={{ minHeight: '100vh', color: '#f8fafc', background: 'radial-gradient(circle at top left,#312e81 0,#0f172a 35%,#020617 100%)', padding: '28px 20px 72px' }}>
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 34, flexWrap: 'wrap' }}>
        <div><Link href="/" style={{ color: '#c4b5fd', textDecoration: 'none', fontWeight: 800 }}>ArtistOS</Link><span style={{ color: '#64748b' }}> / Data Operations</span></div>
        <div style={{ display: 'flex', gap: 16, fontSize: 14 }}><Link href="/fans" style={{ color: '#cbd5e1' }}>Fans</Link><Link href="/industry" style={{ color: '#cbd5e1' }}>Industry</Link><Link href="/properties" style={{ color: '#cbd5e1' }}>Properties</Link></div>
      </nav>
      <header style={{ marginBottom: 26 }}>
        <div style={{ color: '#a78bfa', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: 12 }}>Workspace-safe bulk operations</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 'clamp(34px,5vw,60px)', lineHeight: 1 }}>Import Command Center</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 760, fontSize: 17, lineHeight: 1.65 }}>Parse, map, validate, deduplicate, preview and commit fan, industry-contact and property records without returning to the legacy app. Every database mutation is explicitly scoped to your active workspace.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <span style={{ padding: '7px 11px', borderRadius: 999, background: 'rgba(139,92,246,.18)', color: '#ddd6fe', fontSize: 13 }}>{workspace.role} access</span>
          <span style={{ padding: '7px 11px', borderRadius: 999, background: 'rgba(37,99,235,.18)', color: '#bfdbfe', fontSize: 13 }}>Suppression-safe server commit</span>
          <span style={{ padding: '7px 11px', borderRadius: 999, background: 'rgba(15,118,110,.18)', color: '#99f6e4', fontSize: 13 }}>50,000-row ceiling</span>
        </div>
      </header>
      <ImportWizard />
    </div>
  </main>;
}
