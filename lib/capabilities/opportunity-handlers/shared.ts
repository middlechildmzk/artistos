import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export { findMatches, normalizeName, normalizeUrl } from "@/lib/network-intelligence/source-runtime/matching";

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
