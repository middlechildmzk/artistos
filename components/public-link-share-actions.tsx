"use client";

import { useState } from "react";

type PublicLinkShareActionsProps = {
  title: string;
  artistName: string;
};

export function PublicLinkShareActions({ title, artistName }: PublicLinkShareActionsProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "shared" | "error">("idle");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  async function shareLink() {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({
        title: `${artistName} · ${title}`,
        text: `Listen to ${title} by ${artistName}.`,
        url: window.location.href,
      });
      setStatus("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
    }
  }

  return (
    <div aria-live="polite">
      <div className="public-link-share-actions">
        <button onClick={shareLink} type="button">Share release</button>
        <button onClick={copyLink} type="button">Copy link</button>
      </div>
      {status === "copied" ? <p className="public-link-share-status">Link copied.</p> : null}
      {status === "shared" ? <p className="public-link-share-status">Share sheet opened.</p> : null}
      {status === "error" ? <p className="public-link-share-status">Could not copy automatically. Copy the address from your browser.</p> : null}
    </div>
  );
}
