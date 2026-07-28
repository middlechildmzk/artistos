# Artist Brain v1 to v2 transition

## Decision

`public.artist_brain_facts` remains the historical Brain v1 store during database recovery. It must not be dropped, renamed, or rewritten as part of migration reconciliation.

Brain v2 becomes the long-term authoritative model only after an isolated, evidence-preserving backfill and authenticated application verification.

## Why two stores exist

The production ledger created `artist_brain_facts` before the capability runtime, evidence ledger, and reviewable Brain v2 model existed. The newer model separates concerns that Brain v1 combines in one row:

- `brain_memories`: semantic, episodic, and learned memory containers
- `brain_claims`: reviewable subject-predicate-object claims
- `brain_claim_evidence`: explicit support, contradiction, qualification, and supersession links
- `brain_learning_observations`: measured patterns that are not automatically promoted to fact

The historical table is therefore not deleted merely because the newer design is more expressive.

## Authority during transition

1. Before Brain v2 is applied, Brain v1 remains the live production store.
2. After Brain v2 is applied on an isolated database, Brain v1 is read-only historical input.
3. During authenticated rehearsal, the application reads Brain v2 while a compatibility query can expose unmigrated Brain v1 rows.
4. Production cutover requires count reconciliation, field-level sampling, evidence review, and rollback approval.
5. Brain v1 may be archived only after a full release cycle with no required fallback.

## Deterministic mapping

Each Brain v1 row maps to one Brain v2 semantic memory and one claim.

### Memory mapping

| Brain v1 | Brain v2 memory |
|---|---|
| `workspace_id` | `workspace_id` |
| `artist_id` | `artist_id` |
| `category` | `namespace` |
| generated title | `title` |
| `fact` | `summary` and `content.fact` |
| `source` | `content.legacy_source` |
| `freshness_date` | `observed_at` at midnight UTC when present |
| `confidence` | mapped confidence |
| `created_at` | preserved in `content.legacy_created_at` |
| `id` | preserved in `content.legacy_brain_fact_id` |

`memory_class` is always `semantic` for migrated Brain v1 facts. A legacy fact must never be silently reclassified as episodic or learned.

### Claim mapping

- `claim_type`: `legacy_fact`
- `subject_ref`: `artist:<artist_id>` when present, otherwise `workspace:<workspace_id>`
- `predicate`: normalized `category`, with `legacy_fact` fallback
- `object_value`: `{ "text": <fact>, "legacy_brain_fact_id": <id> }`
- `review_status`: `accepted` only when the legacy row is locked and confidence is verified; otherwise `pending`
- `contradiction_state`: `none`
- `source_retrieved_at`: derived from `freshness_date` when present

## Confidence mapping

| Brain v1 | Brain v2 |
|---|---|
| `verified` | `verified` |
| `supported` | `supported` |
| `weak` | `weak` |
| `unknown` | `unknown` |
| `conflicting` | `conflicting` |
| any unexpected value | `unknown` |

No migration may increase confidence.

## Evidence policy

A legacy `source` string is provenance context, not automatically a verified evidence record.

Backfill behavior:

- Store the original source text on the memory and claim.
- Create an `evidence_record` only when the source can be represented without invention and satisfies evidence validation.
- Leave the claim pending or needing evidence when the source cannot be independently represented.
- Preserve conflicting and stale states rather than normalizing them away.

## Idempotency and rollback

The backfill must use `legacy_brain_fact_id` as its durable idempotency key.

Re-running it must not create duplicate memories or claims. The migration should produce a reconciliation report containing:

- total Brain v1 rows
- mapped rows
- skipped rows
- duplicate-prevented rows
- confidence counts
- accepted versus pending claims
- rows lacking usable provenance

Rollback disables Brain v2 reads and removes only records carrying the backfill marker. It does not modify Brain v1.

## Required rehearsal tests

- Every Brain v1 row is mapped exactly once or appears in an explicit exception report.
- No confidence is promoted.
- Locked verified rows become accepted claims; all other claims remain reviewable.
- Source text is preserved exactly.
- Re-running the backfill produces no duplicates.
- Cross-workspace access is denied.
- Application reads continue if the Brain v2 backfill is rolled back.

## Prohibited shortcuts

- Do not drop `artist_brain_facts` during reconciliation.
- Do not point the application at both stores without explicit precedence.
- Do not treat legacy source text as verified evidence automatically.
- Do not convert all legacy facts into accepted claims.
- Do not merge semantic facts, episodic events, and learned observations into one new table merely to simplify migration.
