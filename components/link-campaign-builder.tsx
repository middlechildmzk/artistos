"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

export function LinkCampaignBuilder({ publicUrl }: { publicUrl: string }) {
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const trackedUrl = useMemo(() => {
    const url = new URL(publicUrl);
    if (source.trim()) url.searchParams.set("utm_source", source.trim());
    if (medium.trim()) url.searchParams.set("utm_medium", medium.trim());
    if (campaign.trim()) url.searchParams.set("utm_campaign", campaign.trim());
    return url.toString();
  }, [campaign, medium, publicUrl, source]);

  async function copyTrackedUrl() {
    await navigator.clipboard.writeText(trackedUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <details>
      <summary>Create a trackable campaign URL</summary>
      <div className="stack mini-form">
        <div className="form-grid">
          <label className="field"><span>Source</span><input className="input" onChange={(event) => setSource(event.target.value)} placeholder="instagram" value={source} /></label>
          <label className="field"><span>Medium</span><input className="input" onChange={(event) => setMedium(event.target.value)} placeholder="social" value={medium} /></label>
          <label className="field full"><span>Campaign</span><input className="input" onChange={(event) => setCampaign(event.target.value)} placeholder="release-week" value={campaign} /></label>
        </div>
        <div className="campaign-url-output"><span>{trackedUrl}</span><button className="button ghost compact" onClick={copyTrackedUrl} type="button">{copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />} {copied ? "Copied" : "Copy"}</button></div>
      </div>
    </details>
  );
}
