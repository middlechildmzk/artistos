# ArtistOS remote migration ledger

Verified against Supabase project `artistos-core` (`myrtdfyjoxvtubusrrmf`) on 2026-07-27.

This ledger records production history only. It does not claim that the corresponding local SQL files have been recovered or replay-tested yet.

| Version | Name | SQL characters |
|---|---|---:|
| 20260711232934 | artistos_core_foundation | 11,282 |
| 20260711233637 | enable_rls_authenticated_only | 458 |
| 20260713011627 | importer_dedupe_constraints | 258 |
| 20260713161400 | phase3_fan_reload_hardening | 298 |
| 20260714104403 | create_industry_contacts_and_playlists | 985 |
| 20260716170334 | session_a_rls_lockdown | 2,346 |
| 20260716170353 | session_b_ai_generations_audit | 1,977 |
| 20260716174354 | session_b_revoke_anon_ai_generations | 363 |
| 20260716175557 | session_b1_ai_generations_creator_rls | 2,578 |
| 20260717210719 | session_c_execution_loop | 4,137 |
| 20260724203954 | artistos_integrations | 2,812 |
| 20260724204056 | artistos_integrations_hardening | 542 |
| 20260724204234 | artistos_advisor_fixes | 1,344 |
| 20260724212131 | temporary_artistos_transfer_cleanup_policy | 249 |
| 20260724212337 | remove_temporary_artistos_transfer_cleanup_policy | 78 |
| 20260725155847 | artistos_music_intelligence | 9,636 |
| 20260725160343 | artistos_social_execution | 2,240 |
| 20260726184029 | workspace_tenancy_phase_a_additive | 4,033 |
| 20260726184111 | workspace_tenancy_phase_a_defaults | 1,054 |
| 20260726193925 | parity_sprint_schema | 7,722 |
| 20260726234539 | harden_workspace_rls_and_storage | 9,144 |
| 20260726234616 | fix_workspace_membership_policy_recursion | 1,007 |
| 20260726234727 | align_authenticated_table_grants_with_rls | 962 |
| 20260727002138 | asset_upload_limits_and_core_indexes | 1,966 |
| 20260727132555 | automatic_workspace_provisioning | 1,665 |
| 20260727134616 | add_artistos_intelligence_modules | 4,311 |
| 20260727143513 | artistos_intelligence_operating_layer_v2 | 9,486 |
| 20260727144623 | add_agent_execution_control_plane_v2 | 5,022 |

## Recovery checklist

For each row:

- [ ] Export the exact `statements[1]` value.
- [ ] Save it as `migrations/<version>_<name>.sql`.
- [ ] Normalize line endings only; do not rewrite the SQL.
- [ ] Record a SHA-256 digest of the recovered SQL.
- [ ] Compare the digest to a digest computed from production history.
- [ ] Replay all migrations in order against a disposable branch.
- [ ] Compare tables, columns, constraints, indexes, functions, grants, policies, views, triggers, and storage configuration with production.

## Safety note

Several historical migrations intentionally widened access before later migrations hardened it. They must be replayed only in an isolated database and in full order. Do not apply individual recovered historical migrations to production.
