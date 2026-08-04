import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCapabilityHandler } from "../handlers";
import { reviewOpportunityCapability } from "../opportunity-registry";
import { readReplay, writeReplay } from "./shared";

registerCapabilityHandler(reviewOpportunityCapability, async ({ ctx, input, idempotencyKey }) => {
  const key = idempotencyKey ?? input.idempotencyKey;
  const replay = await readReplay(ctx.workspaceId, reviewOpportunityCapability.name, key);
  if (replay && typeof replay === "object" && "opportunityId" in replay) return { output: replay as never, evidenceIds: [] };
  const supabase = await createSupabaseServerClient();
  const { data: opportunity, error } = await supabase.from("opportunities").select("id,review_status,review_disposition,evidence_ids").eq("workspace_id", ctx.workspaceId).eq("id", input.opportunityId).maybeSingle();
  if (error) throw error;
  if (!opportunity) throw new Error("opportunity_not_found");
  let matchedEntityType = input.matchedEntityType ?? null;
  let matchedEntityId = input.matchedEntityId ?? null;
  if (input.matchCandidateId) {
    const { data: match, error: matchError } = await supabase.from("opportunity_match_candidates").select("candidate_entity_type,candidate_entity_id").eq("workspace_id", ctx.workspaceId).eq("opportunity_id", opportunity.id).eq("id", input.matchCandidateId).maybeSingle();
    if (matchError) throw matchError;
    if (!match) throw new Error("match_candidate_not_found");
    matchedEntityType = match.candidate_entity_type;
    matchedEntityId = match.candidate_entity_id;
    await supabase.from("opportunity_match_candidates").update({ review_status: "accepted", reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", input.matchCandidateId);
  }
  if (["enrich_existing", "merge_existing"].includes(input.disposition) && (!matchedEntityType || !matchedEntityId)) throw new Error("match_required");
  const reviewStatus = input.disposition === "reject" ? "rejected" : input.disposition === "quarantine" ? "quarantined" : input.disposition === "verify_more" ? "needs_verification" : "accepted";
  const status = reviewStatus === "rejected" ? "rejected" : reviewStatus === "accepted" ? "qualified" : "qualifying";
  const changed = opportunity.review_status !== reviewStatus || opportunity.review_disposition !== input.disposition;
  const { error: updateError } = await supabase.from("opportunities").update({ review_status: reviewStatus, review_disposition: input.disposition, review_note: input.note ?? null, matched_entity_type: matchedEntityType, matched_entity_id: matchedEntityId, status, reviewed_by: ctx.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", opportunity.id);
  if (updateError) throw updateError;
  const result = { opportunityId: opportunity.id, reviewStatus, disposition: input.disposition, changed };
  await writeReplay({ workspaceId: ctx.workspaceId, capabilityName: reviewOpportunityCapability.name, key, result, userId: ctx.userId });
  return { output: result, evidenceIds: opportunity.evidence_ids ?? [] };
});
