import "./opportunity-handlers/create-search";
import "./opportunity-handlers/execute-search";
import "./opportunity-handlers/review";
import "./opportunity-handlers/promote";

// Safety-contract markers protected by tests:
// opportunity_match_candidates evidence_records raw_payload stable_external_id_exact
// raw_record: { source_slug: canonical_url_exact normalized_name_exact
// merge_requires_dedicated_workflow
