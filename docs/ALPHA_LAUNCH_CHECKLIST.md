# ArtistOS Alpha Launch Checklist

## P0 security

- [x] Replace unconditional authenticated write policies with workspace-scoped RLS.
- [x] Make application storage private and remove anonymous object policies.
- [x] Verify the owner can read and write the existing workspace.
- [x] Verify an unrelated authenticated user sees zero workspace data.
- [x] Verify unauthorized inserts fail.
- [ ] Enable Supabase leaked-password protection.
- [ ] Add automated cross-workspace tests using two real test users.
- [ ] Add secure membership invitation and role-management workflow.
- [ ] Add upload MIME type and file-size restrictions.
- [ ] Review OAuth encryption and token-access boundaries.

## Canonical runtime

- [x] Use `middlechildmzk/artistos` as the canonical repository.
- [x] Use `claude-major-rebuild` as the readable implementation base.
- [x] Use Supabase `artistos-core` as the shared database.
- [ ] Confirm `artistos-next` as the canonical Vercel project.
- [ ] Verify required environment variables in preview and production.
- [ ] Run lint, typecheck, tests, build, and dependency audit.
- [ ] Smoke-test authenticated routes in a deployed preview.
- [ ] Promote a verified deployment to production.

## Golden path

- [x] Never Alone live release command center.
- [x] Creator Studio hub.
- [x] Campaign Intelligence hub.
- [x] Free tools acquisition hub.
- [x] Connected sidebar architecture.
- [ ] Artist onboarding and workspace creation.
- [ ] Create-release flow for a new artist.
- [ ] Release readiness assessment.
- [ ] Persisted Creator Studio output.
- [ ] Campaign creation and target selection.
- [ ] Outreach follow-up and outcome recording.
- [ ] Release retrospective.

## First functional free tools

- [ ] Spotify Pitch Builder.
- [ ] Release Timeline Generator.
- [ ] Music Prompt Builder.
- [ ] Playlist Pitch Builder.
- [ ] Artwork Validator.

## Alpha cohort

- [ ] Internal daily use by Middle Child.
- [ ] Five guided artist onboarding sessions.
- [ ] Twenty-five verified curator or partner profiles.
- [ ] Session observation notes.
- [ ] Activation and retention events.
- [ ] Pricing interview and willingness-to-pay notes.
- [ ] Publish the first evidence-based case study.
