import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/free-music-smart-link", "/l/"],
      disallow: ["/dashboard", "/network", "/opportunities", "/targets", "/releases", "/links", "/studio", "/campaigns", "/proof", "/analytics", "/audience", "/brain", "/settings", "/connections", "/integrations", "/automations", "/approvals", "/execution"],
    },
    sitemap: baseUrl + "/sitemap.xml",
  };
}
