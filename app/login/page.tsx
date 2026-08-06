"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Notice = { tone: "error" | "success"; text: string } | null;

const capabilities = [
  "Release-specific opportunity matches",
  "Playlists, radio, media, labels and sync",
  "Music smart links and fan attribution",
  "Pitch, follow-up and outcome tracking",
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setNotice({ tone: "error", text: error.message });
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function sendMagicLink() {
    if (!email) {
      setNotice({ tone: "error", text: "Enter your email first." });
      return;
    }
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    setNotice(error
      ? { tone: "error", text: error.message }
      : { tone: "success", text: "Magic link sent. Check your email to continue." });
  }

  return (
    <main className="login-page">
      <div className="login-layout">
        <section className="login-intro" aria-labelledby="artistos-login-title">
          <div className="brand login-brand">
            <div className="logo">A</div>
            <div><div className="eyebrow">Opportunity intelligence for artists</div><strong>ArtistOS</strong></div>
          </div>
          <div className="login-copy">
            <span className="pill">Built for independent artists</span>
            <h1 id="artistos-login-title">Know where your next release belongs.</h1>
            <p>Find the right playlists, radio, blogs, labels, sync opportunities, creators and industry contacts, then keep every pitch and result connected.</p>
          </div>
          <div className="feature-grid">
            {capabilities.map((capability) => <div className="feature-chip" key={capability}><span aria-hidden="true">✓</span>{capability}</div>)}
          </div>
          <p className="login-trust">Network Intelligence gets you in. The connected artist workspace keeps you growing.</p>
        </section>

        <section className="card login-card stack" aria-label="Sign in to ArtistOS">
          <div>
            <div className="eyebrow">Welcome back</div>
            <h2 className="login-heading">Continue to your workspace</h2>
            <p className="muted">Use your password or request a secure magic link.</p>
          </div>
          {notice ? <div className={`notice ${notice.tone}`} role="status" aria-live="polite">{notice.text}</div> : null}
          <form className="stack" onSubmit={signIn}>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" inputMode="email" autoComplete="email" required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field">
              <span>Password</span>
              <input className="input" type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button className="button primary login-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
          </form>
          <div className="login-divider"><span>or</span></div>
          <button className="button ghost" type="button" onClick={sendMagicLink} disabled={busy}>Email me a magic link</button>
          <Link className="button tour-link" href="/tour">See how ArtistOS works</Link>
          <p className="login-footnote">Use a magic link to create or access your secure workspace.</p>
        </section>
      </div>
    </main>
  );
}
