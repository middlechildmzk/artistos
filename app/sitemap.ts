import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://artistos-next.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/verified-routes`, changeFrequency: "weekly", priority: 0.95 },
    { url: `${siteUrl}/music-submission-sites`, changeFrequency: "weekly", priority: 0.95 },
    { url: `${siteUrl}/radio-stations-accepting-music`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/music-blogs-accepting-submissions`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/sync-licensing-submissions`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/methodology`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
