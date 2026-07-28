# ArtistOS Deployment Parity Report

Date: 2026-07-26

## Decision

Use `artistos-next` as the canonical runtime and `middlechildmzk/artistos` as the canonical repository. Treat `aristos-phi` as a legacy prototype whose useful interactions must be migrated before retirement.

## Canonical runtime: artistos-next

Observed:

- Next.js application
- secure password login and magic-link login
- server-rendered authenticated entry point
- private workspace positioning
- no hardcoded email in the rendered login form
- suitable base for shared Artist Graph, Release Workspace, Creator Studio, Campaign Intelligence, and Network Intelligence

## Legacy runtime: aristos-phi

Observed:

- single HTML application
- Supabase and XLSX loaded from public CDNs
- publishable Supabase key embedded directly in the page
- login email prefilled with `dan@artistos.app`
- Middle Child and Never Alone content hardcoded throughout
- fixed release date, artist, distributor, and campaign assumptions
- direct browser queries and mutations
- client-side CSV/XLSX imports and rollback behavior

The publishable key itself is intended for browser use, but the overall implementation is not the future production architecture because it hardcodes one artist and bypasses the canonical Next.js service boundaries.

## Legacy capabilities to preserve

The following behaviors are useful and must be ported into the canonical app:

1. Today view with release countdown, open tasks, blocked tasks, and follow-ups.
2. Targets directory with search, trust/risk labels, fit sorting, and target details.
3. Submission routes, people, outcome history, and relationship signals on target profiles.
4. Outreach logging and follow-up tracking.
5. Fan CRM using the suppression-safe `contactable_fans` view.
6. CSV/XLSX import mapping, dry run, batch tracking, and rollback.
7. Campaign summary and progress indicators.

## Required improvements during migration

- derive current artist, release, campaign, and workspace dynamically
- never hardcode user email, artist identity, dates, or campaign details
- use server-side validation for imports and AI generation
- require `workspace_id` on all writes
- preserve source, batch, and rollback lineage
- use signed/private storage paths
- separate public profile data from private CRM, contact, risk, and suppression data
- replace prompt/confirm browser interactions with accessible application UI
- add analytics for activation and workflow completion

## Retirement gate

Do not remove the legacy deployment until all seven capability groups above have passed parity testing in `artistos-next`. After parity:

- remove production aliases from the legacy project
- mark it archived in the inventory
- keep a source snapshot for historical reference
- stop maintaining or importing data through the old interface
