export type YouTubeChannelIdentity = {
  id: string;
  title: string;
  customUrl?: string | null;
};

export type YouTubeProfileIdentity = {
  artist_name?: string | null;
  external_artist_id?: string | null;
  profile_url?: string | null;
  source_type?: string | null;
  metadata?: unknown;
};

export function normalizeYouTubeIdentity(value: string | null | undefined) {
  if (!value) return "";
  let candidate = value.trim().toLowerCase();
  try {
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      const url = new URL(candidate);
      candidate = url.pathname.split("/").filter(Boolean).pop() ?? candidate;
    }
  } catch {
    // Treat malformed URLs as literal identifiers and normalize below.
  }
  return candidate.replace(/^@/, "").replace(/[^a-z0-9_-]+/g, "");
}

function profileCandidates(profile: YouTubeProfileIdentity) {
  return [profile.external_artist_id, profile.profile_url]
    .map(normalizeYouTubeIdentity)
    .filter(Boolean);
}

function channelCandidates(channel: YouTubeChannelIdentity) {
  return [channel.id, channel.customUrl, channel.title]
    .map(normalizeYouTubeIdentity)
    .filter(Boolean);
}

export function profileMatchesYouTubeChannel(
  profile: YouTubeProfileIdentity,
  channel: YouTubeChannelIdentity,
) {
  const expected = new Set(profileCandidates(profile));
  if (!expected.size) return false;
  return channelCandidates(channel).some((candidate) => expected.has(candidate));
}

export function canonicalArtistIdFromProfile(profile: YouTubeProfileIdentity | null | undefined) {
  if (!profile?.metadata || typeof profile.metadata !== "object" || Array.isArray(profile.metadata)) return null;
  const value = (profile.metadata as Record<string, unknown>).canonical_artist_id;
  return typeof value === "string" && value.trim() ? value : null;
}

export function expectedYouTubeIdentityLabel(profile: YouTubeProfileIdentity) {
  return profile.external_artist_id?.trim()
    || profile.profile_url?.trim()
    || profile.artist_name?.trim()
    || "the mapped YouTube channel";
}
