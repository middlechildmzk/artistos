"use client";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="login-page"><div className="login-card"><div className="notice danger">{error.message || 'ArtistOS could not complete that request.'}</div><button className="button primary section" onClick={reset}>Try again</button></div></main>;
}
