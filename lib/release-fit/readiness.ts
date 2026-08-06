/**
 * Shortlist readiness.
 *
 * Readiness is derived from the evidence attached to a discovery. A user cannot
 * declare a target ready; they can only supply evidence that makes it ready.
 * Kept dependency-free so it is directly executable under the test runner.
 */
export type ReadinessInput = {
  review_status?: string | null;
  external_id?: string | null;
  canonical_url?: string | null;
  corroboration_count?: number | null;
  risk_flags?: unknown;
};

export type ReadinessResult = { state: string; blocking: string[] };

export function deriveReadiness(opportunity: ReadinessInput): ReadinessResult {
  const blocking: string[] = [];
  const flags = Array.isArray(opportunity.risk_flags) ? opportunity.risk_flags.map(String) : [];
  if (!opportunity.external_id && !opportunity.canonical_url) blocking.push("no_stable_identity");
  if ((opportunity.corroboration_count ?? 1) < 2) blocking.push("single_source_only");
  if (flags.includes("submission_route_unverified")) blocking.push("route_unverified");
  if (opportunity.review_status === "quarantined") blocking.push("quarantined");
  if (opportunity.review_status === "rejected") blocking.push("rejected");

  let state: string;
  if (blocking.includes("rejected") || blocking.includes("quarantined")) state = "blocked";
  else if (blocking.includes("no_stable_identity") || blocking.includes("single_source_only")) state = "evidence_missing";
  else if (blocking.includes("route_unverified")) state = "route_unverified";
  else if (opportunity.review_status === "accepted") state = "ready_to_propose";
  else state = "needs_review";

  return { state, blocking };
}
