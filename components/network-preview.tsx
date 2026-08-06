"use client";

import { ArrowUpRight, Bookmark, Route, Sparkles } from "lucide-react";
import { useState } from "react";
import styles from "@/app/home.module.css";

const categories = ["All", "Playlists", "Radio", "Media", "Labels", "Sync"] as const;
type Category = (typeof categories)[number];

const opportunities = [
  {
    name: "Proximity",
    type: "Playlists",
    subtitle: "YouTube channel and electronic curator",
    audience: "5.3M",
    fit: 94,
    tags: ["Future Bass", "Melodic Bass", "Electronic"],
    route: "Direct submission",
    reason: "Strong melodic-bass audience and a verified route.",
  },
  {
    name: "KEXP",
    type: "Radio",
    subtitle: "Independent radio",
    audience: "Seattle",
    fit: 88,
    tags: ["Indie Electronic", "Discovery", "Radio"],
    route: "Music director",
    reason: "Independent programming with an established music intake.",
  },
  {
    name: "EARMILK",
    type: "Media",
    subtitle: "Music publication",
    audience: "136K",
    fit: 85,
    tags: ["Electronic", "Editorial", "Premieres"],
    route: "Submission platform",
    reason: "Electronic coverage and a public submission workflow.",
  },
  {
    name: "Anjunadeep",
    type: "Labels",
    subtitle: "Electronic label",
    audience: "Global",
    fit: 82,
    tags: ["Melodic", "Deep", "Electronic"],
    route: "Demo form",
    reason: "Genre alignment and an official demo intake route.",
  },
  {
    name: "Musicbed",
    type: "Sync",
    subtitle: "Music licensing",
    audience: "Global",
    fit: 79,
    tags: ["Sync", "Creator-friendly", "Instrumental"],
    route: "Artist application",
    reason: "A useful fit for instrumental and visual-media versions.",
  },
] as const;

export function NetworkPreview() {
  const [category, setCategory] = useState<Category>("All");
  const visible = category === "All" ? opportunities.slice(0, 3) : opportunities.filter((item) => item.type === category);

  return (
    <div className={styles.previewFrame} aria-label="Interactive ArtistOS Network preview">
      <div className={styles.previewTopbar}>
        <div>
          <span className={styles.previewEyebrow}>ArtistOS Network</span>
          <strong>Best fits for your next release</strong>
        </div>
        <span className={styles.previewRelease}><i aria-hidden="true" /> Never Alone</span>
      </div>

      <div className={styles.previewToolbar}>
        <div className={styles.previewSearch}>
          <Sparkles aria-hidden="true" size={15} />
          <span>melodic bass · emotional · cinematic</span>
        </div>
        <div className={styles.previewCategories} aria-label="Filter preview">
          {categories.map((item) => (
            <button
              aria-pressed={category === item}
              className={category === item ? styles.previewCategoryActive : undefined}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.previewResults}>
        {visible.map((item) => (
          <article className={styles.previewResult} key={item.name}>
            <div className={styles.previewIdentity}>
              <span className={styles.previewAvatar}>{item.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{item.name}</strong>
                <span>{item.subtitle}</span>
              </div>
            </div>
            <div className={styles.previewResultBody}>
              <div className={styles.previewTags}>{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <p>{item.reason}</p>
            </div>
            <div className={styles.previewSignals}>
              <span><b>{item.fit}%</b> release fit</span>
              <span><Route aria-hidden="true" size={13} /> {item.route}</span>
              <span><b>{item.audience}</b> audience</span>
            </div>
            <div className={styles.previewActions}>
              <button aria-label={"Save " + item.name} type="button"><Bookmark aria-hidden="true" size={14} /></button>
              <button aria-label={"View " + item.name} type="button"><ArrowUpRight aria-hidden="true" size={14} /></button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
