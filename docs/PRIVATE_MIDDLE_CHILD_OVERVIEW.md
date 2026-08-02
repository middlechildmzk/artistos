# Private Middle Child Overview

## Purpose

Make the authenticated ArtistOS dashboard the truthful private operating view for Middle Child while preserving source, consent, suppression, and provider-state distinctions.

## Dashboard coverage

The overview now combines:

- Current artist and release state
- Release tasks and blockers
- Source-visible public music metrics with capture dates
- Imported fan records and deliverability counts without treating them as automatically sendable
- Industry-contact and organization counts
- Google and YouTube, Spotify, Kit, and Soundcharts source health
- Campaign, outcome, smart-link, link-event, Proof, Artist Brain, and suppression counts
- Follow-ups, recommendations, and next actions

## Trust boundaries

- Imported fan records are not labeled contactable.
- Suppression and consent must be checked again before any send.
- Public profile identification is not presented as private analytics authorization.
- Configured, authorized, and provider-verified source states remain distinct.
- Sending, publishing, spending, destructive actions, access changes, and production rollout remain human-controlled.

## Verification

- Existing architecture and safety suite: 123 tests passed before this change.
- Private overview tests added: 2 tests.
- Local total: 125 passing tests.
- Dashboard TypeScript/JSX syntax checked with the available TypeScript compiler.
- Full local dependency install and production build were unavailable because the internal package registry did not contain `@supabase/ssr`; GitHub CI and the protected Vercel preview remain the authoritative build gates.

## Deployment boundary

This change is intended for a protected preview first. It does not authorize production promotion or mutate production data.
