# ArtistOS production authority reconciliation — 2026-09-28

## Verdict

**PARTIALLY AUTHORITATIVE. Production reproducibility remains BLOCKED.**

ArtistOS is not merely design/dormant: the live `artistos-core` Supabase project contains real ArtistOS production data and later ArtistOS migrations. However, the repository cannot yet be treated as a complete reproducible authority for the shared production database.

This document supersedes the *current-state conclusion* in `FOUNDATION_AUDIT.md`; the older audit remains useful historical evidence for why the rollout gate exists.

## Live project

Supabase project:

`artistos-core` / `myrtdfyjoxvtubusrrmf`

Live migration ledger on 2026-09-28:

- **56** total migrations.
- **47** migration files in the ArtistOS repository.
- **44** live versions match source-controlled ArtistOS migration versions exactly.
- **3** ArtistOS migrations have the same migration name and canonically identical SQL, but different version timestamps between source and the live ledger.
- **9** live BVSS migrations are not in the ArtistOS repo. They belong to the BVSS application and are being recovered into `middlechildmzk/middle-child-experience`.

## Timestamp-only ArtistOS migration divergence

The following live migrations have the same names and canonically identical SQL as the repo files, but their version timestamps differ:

| Migration | Repo version | Live version | SQL comparison |
|---|---|---|---|
| network_intelligence_contact_safety | 20260804143000 | 20260805163134 | canonical SQL equal |
| network_source_runtime_v1 | 20260804163000 | 20260805163230 | canonical SQL equal |
| network_discovery_v2 | 20260805150000 | 20260805163254 | canonical SQL equal |

The comparison stripped comments and normalized whitespace only; the resulting SQL bodies were byte-for-byte equal.

This is **not semantic schema drift**, but it is still migration-ledger/source-control drift because the migration version is part of the applied history. Do not rename applied history or repair ledger rows casually.

## BVSS migrations in the shared project

The live project also contains these nine later migrations:

- `20260926153552_bvss_playlist_os_foundation`
- `20260926154658_bvss_playlist_os_security_and_indexes`
- `20260926181236_bvss_curator_network_v1_v2_foundation`
- `20260926182509_bvss_network_v2_upload_safety`
- `20260926182640_bvss_curator_network_v2_entitlements`
- `20260926183528_bvss_curator_network_v2_indexes`
- `20260926184929_bvss_submission_progressive_identification`
- `20260926203817_add_bvss_admin_password_setup_tokens`
- `20260928163302_bvss_playlist_share_event`

They are being recovered from the live migration ledger into the BVSS repository. They should not be duplicated into ArtistOS merely to make a count match. The shared database now has **cross-repo migration ownership**, which needs an explicit replay/orchestration policy.

## Live data occupancy

Read-only counts from the production project on 2026-09-28:

| Surface | Rows | Authority implication |
|---|---:|---|
| artists | 2 | real production state |
| releases | 2 | real production state |
| campaigns | 1 | real production state |
| campaign_targets | 0 | schema/runtime present, no production history |
| campaign_submissions | 0 | schema-only operationally |
| submission_feedback | 0 | schema-only operationally |
| submission_messages | 0 | schema-only operationally |
| properties | 3,224 | real production state |
| playlist_placements | 57 | real production state |
| outcomes | 19 | real production state |
| evidence_records | 27 | real production state |
| people | 5,684 | real production state |
| organizations | 187 | real production state |
| submission_endpoints | 50 | real production state |
| interactions | 0 | relationship history is not yet populated |
| artist_brain_facts | 0 | no live Brain v1 facts |
| brain_claims | 0 | Brain v2 not operationally populated |
| brain_memories | 0 | Brain v2 not operationally populated |
| knowledge_entities | 0 | knowledge graph not operationally populated |
| knowledge_entity_links | 0 | knowledge graph not operationally populated |

## Authority map

### Treat as authoritative / production-bearing

Subject to normal row-level provenance and workspace scope:

- artist identities already present in `artists`
- releases already present in `releases`
- the existing campaign row
- properties / promotion-property inventory
- playlist placements
- outcomes
- evidence records
- people / organizations
- submission endpoints

### Treat as partially authoritative

- campaign model: real schema + one real campaign, but target/submission history is empty
- network intelligence: significant production inventory exists, but interaction history is empty
- release command-center schema: live and source-backed, but should be verified per workflow before becoming the One Campaign write authority

### Treat as dormant / non-authoritative for current product decisions

- ArtistOS submission path (`campaign_submissions`, feedback/messages): zero rows
- Brain v2: tables exist, zero operational rows
- knowledge graph: tables exist, zero operational rows

## Why the rollout gate remains blocked

The original audit's statement that the historical migration set was largely absent is no longer current. The repository now contains the recovered ArtistOS migration history.

However, a formal production-reproducibility `GO` is still blocked because:

1. three applied ArtistOS migration versions do not match their source-controlled filenames;
2. the shared live ledger now spans at least two repositories;
3. the remote manifest is stale (captured 2026-08-04 and stops before later live migrations);
4. clean replay must understand the cross-repo ordered ledger rather than replaying ArtistOS in isolation;
5. the existing rollout gate requires exact reviewed migration history and authenticated replay evidence.

## Recommended next reconciliation work

Do **not** mutate production to make the ledger look cleaner.

Instead:

1. preserve the three timestamp-divergent ArtistOS files and document the live-version aliases;
2. finish BVSS exact migration recovery in the BVSS repo;
3. introduce a cross-repo ledger manifest that maps each live migration version to its owning repository/path;
4. update the remote migration manifest from the current 55-row ledger;
5. rehearse a clean database replay using the ordered cross-repo manifest;
6. compare resulting schema to the linked live project;
7. only then revisit the formal ArtistOS rollout gate.

## One Campaign implication

For the current One Campaign pilot:

- ArtistOS reads may use production-bearing Artist / Release / Campaign / Property / Placement / Outcome / Evidence facts.
- ArtistOS must **not** become the new submission write authority merely because the tables exist.
- The source-controlled pilot manifest remains the campaign identity fallback until the migration/replay gate is resolved.
- No migration or production write is required for the current read-only bridge tranches.
