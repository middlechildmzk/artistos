import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/verified-routes`, changeFrequency: "weekly", priority: 0.95 },
    { url: `${siteUrl}/music-submission-sites`, changeFrequency: "weekly", priority: 0.95 },
    { url: `${siteUrl}/radio-stations-accepting-music`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/college-radio-stations-accepting-music`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/music-blogs-accepting-submissions`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/sync-licensing-submissions`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/research/music-submission-route-verification`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/methodology`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
