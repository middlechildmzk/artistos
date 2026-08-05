import type { SourceAdapter, SourceSlug } from "./types";
import { blockedAdapter } from "./blocked";
import { radioBrowserAdapter } from "./radio-browser";
import { wikidataAdapter } from "./wikidata";

const youtubeAdapter = blockedAdapter("youtube");
const xAdapter = blockedAdapter("x");
const musicBrainzAdapter = blockedAdapter("musicbrainz");
const podcastIndexAdapter = blockedAdapter("podcast_index");

const adapters = new Map<SourceSlug, SourceAdapter>([
  [wikidataAdapter.slug, wikidataAdapter],
  [radioBrowserAdapter.slug, radioBrowserAdapter],
  [youtubeAdapter.slug, youtubeAdapter],
  [xAdapter.slug, xAdapter],
  [musicBrainzAdapter.slug, musicBrainzAdapter],
  [podcastIndexAdapter.slug, podcastIndexAdapter],
]);

export function getSourceAdapter(slug: SourceSlug) {
  const adapter = adapters.get(slug);
  if (!adapter) throw new Error(`source_adapter_not_found:${slug}`);
  return adapter;
}

export function listSourceAdapters() {
  return [...adapters.values()];
}
