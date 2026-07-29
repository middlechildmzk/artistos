"use client";

import { useEffect } from "react";

export function PublicLinkTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = {
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
    };

    void fetch(`/api/public-links/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  }, [slug]);

  return null;
}
