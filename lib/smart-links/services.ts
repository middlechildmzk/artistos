export const MUSIC_SERVICES = [
  { id: "spotify", label: "Spotify", hosts: ["open.spotify.com"] },
  { id: "apple_music", label: "Apple Music", hosts: ["music.apple.com", "itunes.apple.com"] },
  { id: "youtube_music", label: "YouTube Music", hosts: ["music.youtube.com", "youtube.com", "www.youtube.com", "youtu.be"] },
  { id: "amazon_music", label: "Amazon Music", hosts: ["music.amazon.com", "music.amazon.co.uk", "amazon.com"] },
  { id: "deezer", label: "Deezer", hosts: ["deezer.com", "www.deezer.com"] },
  { id: "tidal", label: "TIDAL", hosts: ["tidal.com", "listen.tidal.com"] },
  { id: "soundcloud", label: "SoundCloud", hosts: ["soundcloud.com", "on.soundcloud.com"] },
  { id: "bandcamp", label: "Bandcamp", hosts: ["bandcamp.com"] },
  { id: "audius", label: "Audius", hosts: ["audius.co"] },
  { id: "qobuz", label: "Qobuz", hosts: ["qobuz.com", "open.qobuz.com"] },
  { id: "pandora", label: "Pandora", hosts: ["pandora.com", "www.pandora.com"] },
  { id: "iheartradio", label: "iHeartRadio", hosts: ["iheart.com", "www.iheart.com"] },
  { id: "anghami", label: "Anghami", hosts: ["anghami.com", "play.anghami.com"] },
  { id: "boomplay", label: "Boomplay", hosts: ["boomplay.com", "www.boomplay.com"] },
  { id: "napster", label: "Napster", hosts: ["napster.com", "us.napster.com"] },
] as const;

export type MusicServiceId = (typeof MUSIC_SERVICES)[number]["id"] | "other";

function hostMatches(hostname: string, expected: string) {
  return hostname === expected || hostname.endsWith("." + expected);
}

export function inferMusicService(value: string): MusicServiceId {
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return "other";
    const hostname = parsed.hostname.toLowerCase();
    return MUSIC_SERVICES.find((service) => service.hosts.some((host) => hostMatches(hostname, host)))?.id ?? "other";
  } catch {
    return "other";
  }
}

export function musicServiceLabel(serviceId: string) {
  return MUSIC_SERVICES.find((service) => service.id === serviceId)?.label
    ?? serviceId.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function parseMusicDestinationUrls(value: string, limit = 20) {
  const seen = new Set<string>();
  const destinations: Array<{ service: MusicServiceId; url: string }> = [];
  const candidates = value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);

  for (const candidate of candidates) {
    if (destinations.length >= limit) break;
    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:"].includes(parsed.protocol)) continue;
      parsed.hash = "";
      const normalized = parsed.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      destinations.push({ service: inferMusicService(normalized), url: normalized });
    } catch {
      continue;
    }
  }

  return destinations;
}
