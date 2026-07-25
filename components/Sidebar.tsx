"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  ['/', '✦', 'Today'], ['/releases', '◉', 'Releases'], ['/platforms', '◎', 'Music Intelligence'], ['/social', '◈', 'Social'],
  ['/playlists', '♫', 'Playlists'], ['/industry', '◇', 'Industry'], ['/fans', '♡', 'Fans'],
  ['/outreach', '↗', 'Outreach'], ['/content', '▦', 'Content'], ['/assets', '⬡', 'Assets'],
  ['/imports', '⇩', 'Imports'], ['/search', '⌕', 'Search'], ['/integrations', '⚡', 'Integrations'],
] as const;

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">A</div><div><strong>ArtistOS</strong><span>Middle Child release ops</span></div></div>
      <nav className="nav" aria-label="Primary navigation">
        {items.map(([href, icon, label]) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return <Link className={active ? 'active' : ''} href={href} key={href}><span aria-hidden>{icon}</span>{label}</Link>;
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="kicker">Signed in as<br /><strong>{email}</strong></div>
      </div>
    </aside>
  );
}
