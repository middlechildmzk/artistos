# ArtistOS Implementation Backlog

## P0: Safe foundation

- [x] Replace unconditional authenticated write policies with workspace-scoped RLS.
- [x] Make application storage private and remove anonymous listing/upload/update.
- [x] Verify real owner visibility and unrelated-user isolation.
- [ ] Enable Supabase leaked-password protection.
- [ ] Add automated RLS and storage tenancy tests.
- [ ] Add membership invite, acceptance, role-change, and removal workflow.
- [ ] Audit OAuth token access and encryption.
- [ ] Add storage file-size and MIME restrictions.

## P1: Canonical runtime

- [x] Select `middlechildmzk/artistos` as canonical repository.
- [ ] Validate `artistos-next` as canonical Vercel project.
- [ ] Compare `aristos` against `artistos-next` route by route.
- [ ] Inventory environment-variable names and domains.
- [ ] Connect canonical preview to `artistos-core` safely.
- [ ] Add deployment health, auth, storage, and data smoke tests.
- [ ] Archive probes only after feature parity is confirmed.

## P1: Shared application shell

- [ ] Finalize ArtistOS navigation and visual system.
- [ ] Add workspace switcher and role-aware navigation.
- [ ] Add global artist and release selectors.
- [ ] Add command/search surface across artists, releases, contacts, properties, and tasks.
- [ ] Add consistent empty, loading, error, provenance, and confidence states.

## P1: Golden artist path

- [ ] Sign up and create or claim artist profile.
- [ ] Create release workspace.
- [ ] Add metadata, credits, rights-lite, dates, links, and assets.
- [ ] Calculate release-readiness state with explainable checks.
- [ ] Generate and approve Creator Studio outputs.
- [ ] Build campaign from a release.
- [ ] Match and save relevant opportunities.
- [ ] Track outreach, submissions, replies, placements, and results.
- [ ] Complete release retrospective and carry learning forward.

## P1: Creator Studio migration

- [ ] Inventory prompt libraries and generators in Creator Music Prompts repositories and Drive.
- [ ] Define structured prompt schema: intent, genre, mood, energy, BPM, section, instrumentation, vocal, references, exclusions, and platform.
- [ ] Import Suno and Udio prompt workflows.
- [ ] Add lyrics, positioning, visual concept, short-form content, pitch, and one-sheet tools.
- [ ] Save generations to `ai_generations` with prompt version, model, context, approval state, and final text.
- [ ] Add free limits and Pro entitlements.

## P1: Campaign Intelligence migration

- [ ] Map CuratorFit targets to organizations, people, properties, and submission endpoints.
- [ ] Preserve source, verification, trust, risk, freshness, and claim state.
- [ ] Build opportunity directory and saved-list flow.
- [ ] Add explainable fit scoring.
- [ ] Add campaign target stages and interaction history.
- [ ] Add curator claim and preference workflows.

## P1: Network Intelligence

- [ ] Build private research queue.
- [ ] Add CSV and Drive import staging with rollback lineage.
- [ ] Add entity resolution and duplicate review.
- [ ] Add verification and freshness workflows.
- [ ] Add contact qualification, suppression, consent, and permitted-use checks.
- [ ] Add personalized outreach preparation with required human approval.
- [ ] Add invite and profile-claim conversion.

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

## Decision rule

No isolated features. Every feature must attach to identity, release, relationship, evidence, rights, asset, campaign, or outcome primitives and strengthen either the inbound or outbound flywheel.