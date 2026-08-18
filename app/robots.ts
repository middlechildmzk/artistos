import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://artistos-next.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/verified-routes",
        "/music-submission-sites",
        "/radio-stations-accepting-music",
        "/college-radio-stations-accepting-music",
        "/music-blogs-accepting-submissions",
        "/sync-licensing-submissions",
        "/research/music-submission-route-verification",
        "/methodology",
      ],
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/campaigns",
        "/connections",
        "/settings",
        "/approvals",
        "/audience",
        "/automations",
        "/brain",
        "/command-center",
        "/execution",
        "/integrations",
        "/intelligence",
        "/network",
        "/opportunities",
        "/relationships",
        "/releases",
        "/targets",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
