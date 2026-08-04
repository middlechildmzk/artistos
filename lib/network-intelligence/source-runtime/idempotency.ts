import { createHash } from "node:crypto";

export function semanticIdempotencyKey(prefix: string, values: unknown[]) {
  const serialized = values.map((value) => {
    if (Array.isArray(value)) return [...value].map(String).sort().join("\u001e");
    if (value == null) return "";
    return String(value);
  }).join("\u001f");
  const digest = createHash("sha256").update(serialized, "utf8").digest("hex");
  return `${prefix}:${digest}`;
}
