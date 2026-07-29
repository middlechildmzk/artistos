# ArtistOS Implementation Backlog

Updated: 2026-07-29

## P0: Safe foundation

- [x] Replace unconditional authenticated write policies with workspace-scoped RLS.
- [x] Make application storage private and remove anonymous listing/upload/update.
- [x] Verify real owner visibility and unrelated-user isolation.
- [x] Add automated RLS tenancy tests for owner, viewer, and outsider roles.
- [x] Restrict workspace-policy helper execution.
- [ ] Enable Supabase leaked-password protection.
- [ ] Add membership invite, acceptance, role-change, and removal workflow.
- [ ] Complete OAuth token-access and encryption audit with live provider credentials.

## P0: Reproducible database history

- [x] Recover the canonical migration sequence through the approved ArtistOS rollout.
- [x] Recover the seven production migrations added after rollout, including ArtistOS Links and dormant marketplace identity tables.
- [ ] Pass exact normalized-content reconciliation for all 40 production migrations.
- [ ] Pass clean-database replay with the complete 40-migration sequence.
- [ ] Refresh the checked-in remote migration ledger and schema fingerprint evidence.

## P1: Canonical runtime

- [x] Select `middlechildmzk/artistos` as the canonical repository.
- [x] Select `artistos-next` as the canonical Vercel project.
- [x] Connect the canonical preview to `artistos-core`.
- [x] Run authenticated owner, viewer, and outsider browser journeys.
- [x] Merge the approved canonical release into `main`.
- [ ] Move the public production alias to the approved current application build after Vercel quota permits it.
- [ ] Disconnect or archive duplicate Vercel projects after dependency review.

## P1: Shared application shell

- [ ] Finalize ArtistOS navigation and visual system.
- [ ] Add workspace switcher and role-aware navigation.
- [ ] Add global artist and release selectors.
- [ ] Add command/search across artists, releases, contacts, properties, links, campaigns, and tasks.
- [ ] Add consistent empty, loading, error, provenance, and confidence states.

## P1: Golden artist path

- [x] Authenticate and automatically provision a workspace.
- [x] Create and update a release workspace through the capability runtime.
- [x] Create a release campaign through the capability runtime.
- [x] Track campaign targets, replies, outcomes, and evidence.
- [ ] Complete artist profile onboarding and Brand Memory setup.
- [ ] Complete deterministic release-readiness checks in the primary release UI.
- [ ] Generate and approve Creator Studio outputs attached to the release.
- [ ] Complete a release retrospective and carry verified learning forward.

## P1: ArtistOS Links

- [x] Recover the live smart-link, destination, link-event, fan-consent, and deliverable migrations.
- [x] Preserve one canonical smart link per release.
- [x] Remove IP and user-agent hashes from fan-consent evidence.
- [x] Add audited `links.save` and `links.save_destination` capabilities.
- [x] Add the authenticated `/links` management workspace.
- [ ] Pass typecheck, tests, clean replay, and deployed preview verification.
- [ ] Add a privacy-safe public `/l/[slug]` read boundary exposing only approved release and destination fields.
- [ ] Add destination-click and page-view collection with abuse controls and retention rules.
- [ ] Add consent-backed fan capture and confirmation workflow.
- [ ] Add campaign attribution and release-to-fan conversion reporting.

## P1: Creator Studio migration

- [ ] Inventory prompt libraries and generators in Creator Music Prompts repositories and Drive.
- [ ] Define structured prompt schema: intent, genre, mood, energy, BPM, section, instrumentation, vocal, references, exclusions, and platform.
- [ ] Import Suno and Udio prompt workflows.
- [ ] Add lyrics, positioning, visual concept, short-form content, pitch, and one-sheet tools.
- [ ] Save generations to `ai_generations` with prompt version, model, context, approval state, and final text.
- [ ] Add free limits and Pro entitlements.

## P1: Campaign Intelligence migration

- [x] Use canonical campaigns, campaign targets, interactions, outcomes, and evidence records.
- [x] Preserve source, verification, trust, risk, freshness, and claim primitives in the shared database.
- [x] Recover professional-profile, claim, submission, feedback, and message schema as dormant production history.
- [ ] Rename and consolidate CuratorFit concepts into Campaign Intelligence and Network Intelligence UI surfaces.
- [ ] Map properties and submission endpoints into explainable release-specific recommendations.
- [ ] Add saved opportunity lists and fit explanations.
- [ ] Add curator invitation and claim workflows for a closed verified cohort.
- [ ] Keep the open marketplace UI disabled until the closed alpha proves safety, relevance, and willingness to pay.

## P1: Network Intelligence

- [ ] Build private research queue.
- [ ] Add CSV and Drive import staging with rollback lineage.
- [ ] Add entity resolution and duplicate review.
- [ ] Add verification and freshness workflows.
- [ ] Add contact qualification, suppression, consent, and permitted-use checks.
- [ ] Add personalized outreach preparation with required human approval.
- [ ] Add invite and profile-claim conversion.

## P2: Music Intelligence

- [x] Establish the first streaming, social, playlist, and campaign metric schema.
- [x] Add an initial analytics surface.
- [ ] Add provider ingestion with source, retrieval time, freshness, and rights metadata.
- [ ] Build artist and release benchmarks, comparable-artist tracking, playlist movement, and momentum detection.
- [ ] Connect campaign activity and smart-link conversion to performance changes without overstating causation.
- [ ] Build explainable Artist Brain recommendations from measured changes.

## P2: StackBuilder, education, and free tools

- [ ] Establish topic and keyword clusters.
- [ ] Build Spotify pitch checker and generator.
- [ ] Build release timeline calculator.
- [ ] Build metadata completeness checker.
- [ ] Build artwork dimension validator.
- [ ] Build lyric formatter.
- [ ] Build free music-prompt generator.
- [ ] Build campaign budget planner.
- [ ] Allow anonymous use and account-based saving.
- [ ] Add schema markup, FAQs, citations, author/update signals, and original benchmark research.

## P2: Growth and measurement

- [ ] Define acquisition, activation, product-value, retention, network, and revenue events.
- [ ] Add privacy-aware analytics and attribution.
- [ ] Build onboarding email sequence.
- [ ] Publish Middle Child / Never Alone case study.
- [ ] Recruit 5-10 alpha artists.
- [ ] Recruit 25-50 concentrated, verified network partners.
- [ ] Test free, monthly Pro, and per-release offers.

## Current implementation order

1. Reconcile and replay the full production migration ledger.
2. Verify the authenticated ArtistOS Links workspace in a branch preview.
3. Add the privacy-safe public smart-link surface and consent-backed fan capture.
4. Consolidate Campaign Intelligence and Network Intelligence around the release graph.
5. Extend Music Intelligence with provider-backed measurements and explainable benchmarks.
6. Complete Creator Studio persistence and the first free-tool acquisition loop.
7. Run the closed alpha before exposing any open marketplace behavior.

## Decision rule

No isolated features. Every feature must attach to identity, release, link, relationship, evidence, rights, asset, campaign, fan, metric, or outcome primitives and strengthen either the inbound or outbound flywheel.
