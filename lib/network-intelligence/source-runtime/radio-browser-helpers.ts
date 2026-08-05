const BLOCKED_CALL_SIGNS = new Set(["AI", "AM", "DJ", "EDM", "FM", "UK", "US", "USA"]);

const GENERIC_TOKENS = new Set([
  "active", "accepting", "released", "release", "music", "radio", "station", "stations", "show", "shows",
  "channel", "channels", "find", "target", "targets", "official", "public", "independent", "artist", "artists",
]);

function searchTokens(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function radioBrowserSearchParams(query: string, fitContext?: string | null) {
  const callSign = (query.match(/\b[A-Z]{2,5}(?:-[A-Z]{2,4})?\b/g) ?? []).find((value) => !BLOCKED_CALL_SIGNS.has(value)) ?? null;
  const tokens = searchTokens(`${query} ${fitContext ?? ""}`).filter((token) => !GENERIC_TOKENS.has(token));
  const params = new URLSearchParams({ hidebroken: "true", order: "lastchecktime", reverse: "true" });
  if (callSign) params.set("name", callSign);
  else if (tokens[0]) params.set("tag", tokens[0]);
  return params;
}

export function radioFreshness(lastCheckIso: string | null | undefined, lastCheckOk: boolean, now = new Date()) {
  if (!lastCheckIso) return "unknown" as const;
  const checked = new Date(lastCheckIso);
  if (Number.isNaN(checked.getTime())) return "unknown" as const;
  const ageDays = (now.getTime() - checked.getTime()) / 86_400_000;
  if (!lastCheckOk || ageDays > 30) return "stale" as const;
  if (ageDays > 7) return "aging" as const;
  return "current" as const;
}

export function splitTags(value: unknown) {
  return [...new Set(String(value ?? "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 30);
}

export function safeHttpUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
