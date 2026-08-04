import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DiscoveryCandidate } from "@/lib/network-intelligence/source-runtime/types";

export function normalizeName(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return String(value).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}

export function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function readReplay(workspaceId: string, capabilityName: string, key: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("capability_idempotency").select("result").eq("workspace_id", workspaceId).eq("capability_name", capabilityName).eq("idempotency_key", key).maybeSingle();
  if (error) throw error;
  return data?.result ?? null;
}

export async function writeReplay(args: { workspaceId: string; capabilityName: string; key: string; result: unknown; userId?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capability_idempotency").insert({ workspace_id: args.workspaceId, capability_name: args.capabilityName, capability_version: 1, idempotency_key: args.key, input_hash: args.key, result: args.result, created_by: args.userId ?? null });
  if (error) throw error;
}

type ExistingOrganization = { id: string; canonical_name: string; display_name: string | null; website: string | null; primary_source_url: string | null };
type ExistingProperty = { id: string; organization_id: string | null; name: string; url: string | null; platform_url: string | null; raw_record: Record<string, unknown> | null };
export type MatchSuggestion = { entityType: "organization" | "property"; entityId: string; score: number; reasons: string[]; conflicts: string[] };

export function findMatches(candidate: DiscoveryCandidate, organizations: ExistingOrganization[], properties: ExistingProperty[]) {
  const title = normalizeName(candidate.title);
  const canonicalUrl = normalizeUrl(candidate.canonicalUrl);
  const suggestions: MatchSuggestion[] = [];
  for (const property of properties) {
    const reasons: string[] = [];
    let score = 0;
    const rawId = typeof property.raw_record?.external_id === "string" ? property.raw_record.external_id : null;
    const rawSource = typeof property.raw_record?.source_slug === "string" ? property.raw_record.source_slug : null;
    if (rawId === candidate.externalId && rawSource === candidate.sourceSlug) { score = 1; reasons.push("stable_external_id_exact"); }
    if (canonicalUrl && [property.url, property.platform_url].map(normalizeUrl).includes(canonicalUrl)) { score = Math.max(score, 0.99); reasons.push("canonical_url_exact"); }
    if (title && normalizeName(property.name) === title) { score = Math.max(score, 0.84); reasons.push("normalized_name_exact"); }
    if (score >= 0.8) suggestions.push({ entityType: "property", entityId: property.id, score, reasons, conflicts: [] });
  }
  for (const organization of organizations) {
    const reasons: string[] = [];
    let score = 0;
    if (canonicalUrl && [organization.website, organization.primary_source_url].map(normalizeUrl).includes(canonicalUrl)) { score = 0.98; reasons.push("canonical_url_exact"); }
    if (title && [organization.canonical_name, organization.display_name].map(normalizeName).includes(title)) { score = Math.max(score, 0.82); reasons.push("normalized_name_exact"); }
    if (score >= 0.8) suggestions.push({ entityType: "organization", entityId: organization.id, score, reasons, conflicts: [] });
  }
  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function evidenceConfidence(value: string) {
  return ["verified", "supported", "weak", "unknown"].includes(value) ? value : "unknown";
}

export function orgCategory(type: string) {
  if (type === "radio") return "radio";
  if (type === "playlist") return "playlist";
  if (["youtube_channel", "creator"].includes(type)) return "creator";
  if (["publication", "podcast"].includes(type)) return "media";
  if (["sync", "music_library"].includes(type)) return "sync";
  if (type === "label") return "label";
  if (type === "booking") return "live";
  return "other";
}
