export type SourceCoverage = {
  slug: string;
  label: string;
  connection: "live_api" | "oauth_api" | "catalog_api" | "paid_api" | "export" | "public";
  status: "available" | "configuration_required" | "export_required" | "paid_key_required" | "limited";
  summary: string;
  metrics: string[];
  limitation?: string;
};

export const SOURCE_COVERAGE: SourceCoverage[] = [
  {
    slug: "youtube",
    label: "YouTube / YouTube Music",
    connection: "oauth_api",
    status: "configuration_required",
    summary: "Channel totals and owned-channel analytics through Google OAuth.",
    metrics: ["subscribers", "channel views", "videos", "28-day views", "watch minutes", "subscriber gains/losses"],
    limitation: "The YouTube Data API and YouTube Analytics API must be enabled in the connected Google Cloud project.",
  },
  {
    slug: "spotify",
    label: "Spotify",
    connection: "catalog_api",
    status: "limited",
    summary: "Catalog identity, releases, tracks, and URLs through the public Web API; private artist analytics through export or a licensed provider.",
    metrics: ["catalog metadata", "release identity", "track identity", "Spotify for Artists export"],
    limitation: "Spotify removed artist follower and popularity fields from the Web API in February 2026. Streams and monthly listeners are not available from the public API.",
  },
  {
    slug: "apple-music",
    label: "Apple Music for Artists",
    connection: "export",
    status: "export_required",
    summary: "Import Apple Music for Artists reports while catalog links remain connected to releases.",
    metrics: ["plays", "listeners", "Shazam counts", "purchases", "territories"],
  },
  {
    slug: "instagram",
    label: "Instagram / Facebook",
    connection: "oauth_api",
    status: "configuration_required",
    summary: "Professional-account reach, engagement, audience, and content performance through Meta OAuth.",
    metrics: ["followers", "reach", "impressions", "engagement", "reel/video performance"],
    limitation: "Requires a professional Instagram account connected to a Facebook Page and a configured Meta app.",
  },
  {
    slug: "tiktok",
    label: "TikTok",
    connection: "oauth_api",
    status: "configuration_required",
    summary: "Account and video metrics where TikTok grants approved API access; exports remain supported.",
    metrics: ["followers", "profile views", "video views", "likes", "shares", "comments"],
  },
  {
    slug: "distrokid",
    label: "DistroKid / distributor reports",
    connection: "export",
    status: "export_required",
    summary: "Royalty and store-level performance from distributor CSV exports.",
    metrics: ["streams", "earnings", "store", "territory", "release", "reporting period"],
    limitation: "DistroKid does not provide a general public analytics API for this use case.",
  },
  {
    slug: "chartmetric",
    label: "Chartmetric",
    connection: "paid_api",
    status: "paid_key_required",
    summary: "Licensed cross-platform artist, playlist, chart, audience, and competitor intelligence.",
    metrics: ["playlist movement", "charts", "audience", "social growth", "competitor benchmarks"],
  },
  {
    slug: "soundcharts",
    label: "Soundcharts",
    connection: "paid_api",
    status: "paid_key_required",
    summary: "Licensed radio, playlist, chart, social, and airplay monitoring.",
    metrics: ["airplay", "playlist additions", "charts", "social", "audience"],
  },
  {
    slug: "viberate",
    label: "Viberate",
    connection: "paid_api",
    status: "paid_key_required",
    summary: "Licensed artist analytics, audience, playlist, festival, and industry benchmarks.",
    metrics: ["artist performance", "audience", "playlists", "industry benchmarks"],
  },
  {
    slug: "soundcloud",
    label: "SoundCloud",
    connection: "oauth_api",
    status: "configuration_required",
    summary: "Profile, track, play, like, repost, and comment data where API access is approved.",
    metrics: ["followers", "plays", "likes", "reposts", "comments"],
  },
  {
    slug: "bandcamp",
    label: "Bandcamp",
    connection: "export",
    status: "export_required",
    summary: "Direct-to-fan sales, supporters, and geography through exports and public release metadata.",
    metrics: ["sales", "supporters", "revenue", "territory"],
  },
  {
    slug: "email",
    label: "Email platform",
    connection: "oauth_api",
    status: "configuration_required",
    summary: "Subscriber growth, sends, opens, clicks, and release conversion from Kit or another email provider.",
    metrics: ["subscribers", "opens", "clicks", "unsubscribes", "campaign conversion"],
  },
];

export const SOURCE_COVERAGE_BY_SLUG = new Map(SOURCE_COVERAGE.map((source) => [source.slug, source]));
