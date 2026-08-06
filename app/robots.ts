import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://artistos-next.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/free-music-smart-link", "/l/"],
      disallow: ["/dashboard", "/network", "/opportunities", "/targets", "/releases", "/links", "/studio", "/campaigns", "/proof", "/analytics", "/audience", "/brain", "/settings", "/connections", "/integrations", "/automations", "/approvals", "/execution"],
    },
    sitemap: baseUrl + "/sitemap.xml",
  };
}
