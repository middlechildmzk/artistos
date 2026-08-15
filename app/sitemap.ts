import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://artistos-next.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/verified-routes`, changeFrequency: "weekly", priority: 0.95 },
    { url: `${siteUrl}/methodology`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
