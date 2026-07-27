"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function sendMagicLink() {
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    setMessage(error ? error.message : "Magic link sent. Check your email.");
  }

  return (
    <main className="login-page">
      <section className="card login-card stack">
        <div className="logo">A</div>
        <div>
          <div className="eyebrow">Private artist workspace</div>
          <h1>ArtistOS</h1>
          <p className="muted">Release operations, campaign intelligence, audience, and follow-through in one workspace.</p>
        </div>
        {message ? <div className="notice">{message}</div> : null}
        <form className="stack" onSubmit={signIn}>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="button primary" type="submit" disabled={busy}>{busy ? "Working…" : "Sign in securely"}</button>
        </form>
        <button className="button ghost" type="button" onClick={sendMagicLink} disabled={busy}>Email me a magic link</button>
      </section>
    </main>
  );
}
