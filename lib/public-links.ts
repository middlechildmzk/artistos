import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicLinkDestination = {
  id: string;
  service: string;
  url: string;
  position: number;
};

export type PublicLinkRecord = {
  id: string;
  workspaceId: string;
  releaseId: string;
  slug: string;
  mode: "presave" | "live";
  headline: string | null;
  description: string | null;
  captureEmail: boolean;
  consentCopyVersion: string;
  artistName: string;
  releaseTitle: string;
  featuredArtist: string | null;
  releaseDate: string | null;
  releaseStatus: string;
  artworkUrl: string | null;
  destinations: PublicLinkDestination[];
};

export function cleanPublicText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function loadPublicLink(slug: string): Promise<PublicLinkRecord | null> {
  const normalizedSlug = cleanPublicText(slug, 120).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) return null;

  const supabase = createSupabaseAdminClient();
  const { data: smartLink, error: smartLinkError } = await supabase
    .from("smart_links")
    .select("id,workspace_id,release_id,slug,mode,headline,description,capture_email,consent_copy_version")
    .eq("slug", normalizedSlug)
    .eq("is_active", true)
    .neq("mode", "private")
    .maybeSingle();

  if (smartLinkError) throw smartLinkError;
  if (!smartLink || (smartLink.mode !== "presave" && smartLink.mode !== "live")) return null;

  const [{ data: release, error: releaseError }, { data: destinations, error: destinationError }, { data: artwork, error: artworkError }] = await Promise.all([
    supabase
      .from("releases")
      .select("id,artist_id,title,featured_artist,release_date,status")
      .eq("workspace_id", smartLink.workspace_id)
      .eq("id", smartLink.release_id)
      .maybeSingle(),
    supabase
      .from("smart_link_destinations")
      .select("id,service,url,position")
      .eq("workspace_id", smartLink.workspace_id)
      .eq("smart_link_id", smartLink.id)
      .eq("is_active", true)
      .order("position", { ascending: true }),
    supabase
      .from("assets")
      .select("url,asset_type,created_at")
      .eq("workspace_id", smartLink.workspace_id)
      .eq("release_id", smartLink.release_id)
      .in("asset_type", ["cover_art", "artwork", "cover"])
      .not("url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (releaseError) throw releaseError;
  if (destinationError) throw destinationError;
  if (artworkError) throw artworkError;
  if (!release) return null;

  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("name")
    .eq("workspace_id", smartLink.workspace_id)
    .eq("id", release.artist_id)
    .maybeSingle();
  if (artistError) throw artistError;
  if (!artist) return null;

  return {
    id: smartLink.id,
    workspaceId: smartLink.workspace_id,
    releaseId: smartLink.release_id,
    slug: smartLink.slug,
    mode: smartLink.mode,
    headline: smartLink.headline,
    description: smartLink.description,
    captureEmail: smartLink.capture_email,
    consentCopyVersion: smartLink.consent_copy_version,
    artistName: artist.name,
    releaseTitle: release.title,
    featuredArtist: release.featured_artist,
    releaseDate: release.release_date,
    releaseStatus: release.status,
    artworkUrl: artwork?.[0]?.url ?? null,
    destinations: (destinations ?? []).map((destination) => ({
      id: destination.id,
      service: destination.service,
      url: destination.url,
      position: destination.position,
    })),
  };
}

export async function recordPublicLinkEvent(args: {
  link: PublicLinkRecord;
  eventType: "page_view" | "destination_click" | "fan_signup" | "presave_intent";
  fanId?: string | null;
  destinationService?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  countryCode?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("link_events").insert({
    workspace_id: args.link.workspaceId,
    smart_link_id: args.link.id,
    fan_id: args.fanId ?? null,
    event_type: args.eventType,
    destination_service: cleanPublicText(args.destinationService, 80) || null,
    utm_source: cleanPublicText(args.utmSource, 160) || null,
    utm_medium: cleanPublicText(args.utmMedium, 160) || null,
    utm_campaign: cleanPublicText(args.utmCampaign, 160) || null,
    referrer: cleanPublicText(args.referrer, 500) || null,
    country_code: cleanPublicText(args.countryCode, 2).toUpperCase() || null,
    metadata: args.metadata ?? {},
  });
  if (error) throw error;
}
