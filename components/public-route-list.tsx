import type { PublicVerifiedRoute } from "@/lib/public-verified-routes";

export function PublicRouteList({ routes }: { routes: PublicVerifiedRoute[] }) {
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      {routes.map((route) => (
        <article className="directory-row" key={route.name}>
          <div className="directory-main">
            <div className="tag-row">
              <strong>{route.name}</strong>
              <span className="pill">{route.type}</span>
              <span className="pill">{route.status}</span>
            </div>
            <p className="muted">
              <strong style={{ color: "var(--text)" }}>{route.route}.</strong> {route.requirements}
            </p>
            <div className="tag-row">
              <span className="pill">Verified {route.checked}</span>
              <a className="button ghost compact" href={route.source} target="_blank" rel="noreferrer">Official source ↗</a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
