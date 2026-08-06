import type { MetadataRoute } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://artistos-next.vercel.app";
  const pages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: baseUrl + "/free-music-smart-link", changeFrequency: "monthly", priority: .9 },
  ];

  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from("smart_links").select("slug,updated_at").eq("is_active", true).neq("mode", "private").limit(5000);
    for (const link of data ?? []) {
      pages.push({
        url: baseUrl + "/l/" + link.slug,
        lastModified: link.updated_at ? new Date(link.updated_at) : undefined,
        changeFrequency: "weekly",
        priority: .7,
      });
    }
  } catch {
    return pages;
  }

  return pages;
}
