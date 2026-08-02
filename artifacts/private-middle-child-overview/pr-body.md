## Purpose

Turn the authenticated ArtistOS dashboard into the truthful private Middle Child operating view.

## What changed

- Combines the active artist and release, tasks, recommendations, public metrics, fan imports, industry contacts, source health, campaigns, outcomes, links, Proof, Artist Brain, and suppression counts.
- Shows metric source dates rather than presenting values as live when they are snapshots.
- Distinguishes imported fan records from an execution-ready audience.
- Distinguishes provider identification, configuration, authorization, and verified sync state.
- Surfaces the current Google and YouTube blocker without presenting YouTube as connected.
- Preserves human approval boundaries for consequential execution.

## Verification

- 125 local tests passed, 0 failed.
- Dashboard TypeScript/JSX syntax checked successfully.
- Full local package installation was blocked because the internal package registry did not contain `@supabase/ssr`; GitHub CI and the Vercel protected preview are the authoritative build gates.

## Safety

- No production data was changed.
- No production migration was applied.
- No provider credential was added.
- No production rollout is authorized.

## Required next gates

- GitHub CI
- Protected Vercel preview
- Authenticated owner journey
- 390px mobile verification
- Explicit human production approval after review
