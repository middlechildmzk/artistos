export const targetCategoryTerms: Record<string, readonly string[]> = {
  playlist: ["playlist", "curator", "spotify", "apple music"],
  creator: ["creator", "influencer", "youtube", "tiktok", "instagram", "channel"],
  media: ["blog", "publication", "magazine", "press", "media", "newsletter", "podcast", "editor"],
  radio: ["radio", "station", "broadcast", "show", "music director", "program director"],
  sync: ["sync", "licens", "supervisor", "music library", "trailer", "film", "television", "game"],
  label: ["label", "a&r", "publisher", "publishing"],
  agency: ["agency", "management", "manager", "booking", "promoter", "publicity", "pr"],
  live: ["venue", "festival", "talent buyer", "live music", "campus"],
  platform: ["platform", "marketplace", "directory", "service"],
};

export type TargetCategory = keyof typeof targetCategoryTerms;
export type PermissionState =
  | "marketing_opt_in"
  | "direct_business_relationship"
  | "public_business_contact"
  | "licensed_business_contact"
  | "outreach_not_authorized"
  | "suppressed"
  | "unknown";

export type ContactRouteState =
  | "blocked_suppressed"
  | "needs_verification"
  | "open"
  | "human_review_required"
  | "outreach_not_authorized"
  | "no_route";

export function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeEmail(value: string | null | undefined) {
  const email = normalize(value);
  return email.includes("@") ? email : "";
}

export function parseContactEmails(value: string | null | undefined) {
  const matches = String(value ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map(normalizeEmail).filter(Boolean))];
}

export function categoryMatches(category: string | null | undefined, values: Array<string | null | undefined>) {
  if (!category) return true;
  const terms = targetCategoryTerms[category] ?? [normalize(category)];
  const haystack = values.map(normalize).join(" ");
  return terms.some((term) => haystack.includes(term));
}

export function derivePermissionState(consentStatus: string | null | undefined, isSuppressed = false): PermissionState {
  if (isSuppressed) return "suppressed";
  const status = normalize(consentStatus);
  if (status.includes("business relationship") || status.includes("direct correspondence")) return "direct_business_relationship";
  if (status.includes("licensed")) return "licensed_business_contact";
  if (status.includes("public business contact")) return "public_business_contact";
  if (status.includes("opt-in") || status.includes("opt in") || status.includes("marketing_opt_in")) return "marketing_opt_in";
  if (status.includes("not authorized") || status.includes("do not contact")) return "outreach_not_authorized";
  return "unknown";
}

export function anySuppressed(emails: string[], suppressedEmails: Set<string>) {
  return emails.some((email) => suppressedEmails.has(normalizeEmail(email)));
}

export function deriveContactRouteState(args: {
  emails?: string[];
  suppressedEmails?: Set<string>;
  submissionStatus?: string | null;
  permissionState?: PermissionState;
}): ContactRouteState {
  const emails = args.emails ?? [];
  const suppressedEmails = args.suppressedEmails ?? new Set<string>();
  if (anySuppressed(emails, suppressedEmails) || args.permissionState === "suppressed") return "blocked_suppressed";
  if (normalize(args.submissionStatus) === "needs_verification") return "needs_verification";
  if (normalize(args.submissionStatus) === "open") return "open";
  if (args.permissionState === "direct_business_relationship" || args.permissionState === "licensed_business_contact") return "open";
  if (args.permissionState === "public_business_contact" || args.permissionState === "marketing_opt_in") return "human_review_required";
  if (emails.length) return "outreach_not_authorized";
  return "no_route";
}

export function routeStateLabel(state: ContactRouteState) {
  const labels: Record<ContactRouteState, string> = {
    blocked_suppressed: "Suppressed · blocked",
    needs_verification: "Verify before use",
    open: "Open route",
    human_review_required: "Human review required",
    outreach_not_authorized: "Outreach not authorized",
    no_route: "No contact route",
  };
  return labels[state];
}

export function sourceStrengthLabel(sourceRecordId: string | null | undefined, sourceFile: string | null | undefined) {
  if (sourceRecordId) return "Row-level provenance";
  if (sourceFile) return "Batch-level provenance";
  return "Source unresolved";
}
