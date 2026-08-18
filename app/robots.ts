import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

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
