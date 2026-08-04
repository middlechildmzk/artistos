import type { SourceAdapter, SourceSlug } from "./types";
import { wikidataAdapter } from "./wikidata";
import { youtubeAdapter } from "./youtube";

const adapters = new Map<SourceSlug, SourceAdapter>([
  [wikidataAdapter.slug, wikidataAdapter],
  [youtubeAdapter.slug, youtubeAdapter],
]);

export function getSourceAdapter(slug: SourceSlug) {
  const adapter = adapters.get(slug);
  if (!adapter) throw new Error(`source_adapter_not_found:${slug}`);
  return adapter;
}

export function listSourceAdapters() {
  return [...adapters.values()];
}
