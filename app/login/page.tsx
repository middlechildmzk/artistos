import { signIn, sendMagicLink } from '@/lib/actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : '';
  const message = typeof params.message === 'string' ? params.message : '';
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo">A</div>
        <div className="eyebrow">Private artist workspace</div>
        <h1 style={{fontSize:'2.6rem'}}>ArtistOS</h1>
        <p className="muted">One calm command center for release week, outreach, audience, assets, and follow-through.</p>
        {error && <div className="notice danger">{error}</div>}
        {message && <div className="notice">{message}</div>}
        <form action={signIn} className="stack section">
          <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
          <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" required autoComplete="current-password" /></div>
          <button className="button primary" type="submit">Sign in securely</button>
        </form>
        <div className="section" style={{borderTop:'1px solid var(--line)', paddingTop:18}}>
          <form action={sendMagicLink} className="stack">
            <input type="hidden" name="origin" value={origin} />
            <div className="field"><label htmlFor="magic-email">Or email me a magic link</label><input className="input" id="magic-email" name="email" type="email" required /></div>
            <button className="button ghost" type="submit">Send magic link</button>
          </form>
        </div>
      </section>
    </main>
  );
}
