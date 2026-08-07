import Link from "next/link";
import { redirect } from "next/navigation";
import { isCurrentTokenEnvelope } from "@/lib/integrations/token-crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncSoundchartsReleasePilot } from "@/app/connections/soundcharts-release-pilot-actions";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export async function SoundchartsReleasePilotCard() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const [connectionResult, releasesResult] = await Promise.all([
    supabase
      .from("oauth_connections")
      .select("last_success_at,last_error,metadata,encrypted_access_token,encrypted_refresh_token")
      .eq("workspace_id", membership.workspace_id)
      .eq("user_id", auth.user.id)
      .eq("provider", "soundcharts")
      .maybeSingle(),
    supabase
      .from("releases")
      .select("id,title,isrc,upc,spotify_url,release_date,status")
      .eq("workspace_id", membership.workspace_id)
      .not("isrc", "is", null)
      .order("release_date", { ascending: false }),
  ]);

  const connection = connectionResult.data;
  const releases = releasesResult.data ?? [];
  const connected = isCurrentTokenEnvelope(connection?.encrypted_access_token)
    && isCurrentTokenEnvelope(connection?.encrypted_refresh_token);
  const metadata = asObject(connection?.metadata);
  const endpointRows = Array.isArray(metadata.release_pilot_endpoints)
    ? metadata.release_pilot_endpoints.map(asObject)
    : [];
  const available = endpointRows.filter((row) => row.status === "available").length;
  const unavailable = endpointRows.filter((row) => row.status === "unavailable").length;
  const failed = endpointRows.filter((row) => row.status === "failed").length;
  const lastReleaseId = typeof metadata.release_pilot_release_id === "string" ? metadata.release_pilot_release_id : null;
  const lastRelease = releases.find((release) => release.id === lastReleaseId) ?? null;

  return (
    <section className="shell" style={{ paddingTop: 0 }}>
      <section className="card stack" style={{ marginBottom: 24 }}>
        <div className="section-heading">
          <div>
            <div className="eyebrow">Controlled licensed-data proof</div>
            <h2>Soundcharts release pilot</h2>
            <p className="muted">Resolve one release by exact ISRC, then collect only the playlist, radio, chart, metric, quota, and source-health observations included in the account.</p>
          </div>
          <span className={`pill ${connected ? "" : "blocked"}`}>{connected ? "Credentials validated" : "Credentials required"}</span>
        </div>

        <div className="grid stats">
          <div className="card"><div className="eyebrow">Eligible releases</div><div className="stat-value compact">{releases.length}</div></div>
          <div className="card"><div className="eyebrow">Last provider success</div><strong>{formatDate(connection?.last_success_at)}</strong></div>
          <div className="card"><div className="eyebrow">Endpoint health</div><strong>{endpointRows.length ? `${available} available · ${unavailable} unavailable · ${failed} failed` : "Not tested"}</strong></div>
        </div>

        {connection?.last_error ? <div className="notice"><strong>Last provider error</strong><p className="muted">{connection.last_error}</p></div> : null}
        {lastRelease ? <div className="notice"><strong>Last release tested</strong><p className="muted">{lastRelease.title} · ISRC {lastRelease.isrc} · {formatDate(String(metadata.release_pilot_last_sync_at ?? ""))}</p></div> : null}

        <div className="notice">
          <strong>Write boundary</strong>
          <p className="muted">The sync writes normalized release metrics, deduplicated playlist placements, radio/chart Proof records, endpoint availability, and quota health. Raw Soundcharts response bodies are not retained. A successful request proves only the endpoints and data returned for this account.</p>
        </div>

        {connected && releases.length ? (
          <form action={syncSoundchartsReleasePilot} className="grid two-col">
            <label className="field">
              <span>Release with verified ISRC</span>
              <select className="input" name="releaseId" required defaultValue={releases.find((release) => release.title === "Never Alone")?.id ?? releases[0]?.id}>
                {releases.map((release) => <option key={release.id} value={release.id}>{release.title} · {release.isrc}</option>)}
              </select>
            </label>
            <div className="field">
              <span>&nbsp;</span>
              <button className="button primary" type="submit">Run controlled release sync</button>
            </div>
          </form>
        ) : (
          <div className="tag-row">
            <Link className="button primary" href="/connections">{connected ? "Add a release ISRC" : "Configure Soundcharts"}</Link>
          </div>
        )}

        <p className="muted">Running this action uses production API allowance and creates live workspace observations and Proof receipts. It does not purchase a plan or authorize customer-facing redistribution.</p>
      </section>
    </section>
  );
}
