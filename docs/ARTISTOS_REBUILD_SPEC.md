# ArtistOS Major Rebuild Specification

## Goal

ArtistOS must become the daily operating system for an independent artist, beginning with Middle Child’s “Never Alone (feat. lowly sunday)” release on July 31, 2026. It should turn scattered contacts, playlists, tasks, content, assets, email, and platform data into one simple action-oriented workspace.

The first screen must answer: What should Dan do next today?

## Current verified foundation

- Supabase is healthy and contains real production data.
- 3,175 contactable fans.
- 421 suppressions that must remain authoritative.
- 5,648 industry contacts.
- 3,184 playlists/properties.
- 147 organizations and 10 submission endpoints.
- 19 outcomes, 17 risk records, and 17 relationship signals.
- 25 Never Alone campaign tasks, currently 4 done and 21 open.
- Releases include Never Alone and Mercy.
- The older production UI works.
- A stronger Next.js preview exists, but GitHub main is not a normal deployable source.

## Phase 0: source-control recovery

1. Recover the strongest working Next.js application from the bootstrap artifacts and existing preview.
2. Commit every readable source file to the rebuild branch.
3. Remove the compressed/bootstrap reconstruction process from the canonical deployment path.
4. Preserve the old production deployment until the rebuilt preview passes acceptance.
5. Confirm normal GitHub-to-Vercel preview deployments work from a branch push.
6. Add a complete README, environment-variable reference, setup instructions, and architecture summary.

## Information architecture

### Today

The authenticated home screen. Include:

- Never Alone countdown and campaign progress.
- One prioritized “Do this next” action.
- The next 5–8 actionable tasks.
- Blocked items and what clears them.
- Follow-ups due or overdue.
- Recommended curator/playlist targets for today.
- Content due today and the next scheduled post.
- Gmail drafts waiting for review.
- Integration warnings that actually block work.
- A compact progress recap and small success celebration.

Prioritization must be deterministic and explainable. Use deadline, campaign importance, blocker state, follow-up due date, trust/risk, fit, and previous contact history. AI may summarize the plan but must not be the sole source of priority.

### Releases

- Release list and detailed release workspace.
- Never Alone is the active release.
- Correct canonical credit: “Never Alone (feat. lowly sunday).”
- Distributor DistroKid, label BVSS FVM, release date July 31, 2026, UPC 882877618355.
- Release metadata, links, pitch, lyrics, assets, content calendar, tasks, contacts, outcomes, and notes.
- Rights status and creator-safe usage notes.
- Do not imply placement, licensing, Content ID, or rights clearance that is not recorded.

### Playlist and curator map

Create a useful working view over the existing 3,184 property records and linked organizations/people.

Each record should expose where available:

- playlist/property name and platform
- URL and Spotify identifier
- owner/organization and associated people
- genres, mood, size/followers estimate, geography, and notes
- verified submission route
- trust tier, risk tier, verification state, and source freshness
- Middle Child/Never Alone fit score with reasons
- contact history, outcomes, follow-up date, and current stage
- data source and last retrieval date

Required views:

- ranked list
- saved shortlist
- contacted
- follow-up due
- accepted/placed
- declined
- blocked/high risk
- needs verification

Support filters, sorting, bulk shortlist actions, and CSV export of selected safe fields. Do not treat missing follower counts, emails, or contacts as zero or verified absence.

### Industry CRM

Keep industry people separate from fans. Support people, organizations, submission endpoints, relationship signals, interactions, outcomes, and notes. Provide a single contact/organization detail page that shows all associated evidence and activity.

### Fan CRM

- Use the suppression-safe contactable view by default.
- Search, segment, filter, and inspect fan records.
- Clearly display import source and available consent/verification facts.
- Unsubscribe/suppress actions require confirmation.
- No suppressed address may appear in sendable segments.
- Do not merge fan and industry records simply because emails match.

### Outreach workspace

- Create pitch/email drafts from a release plus selected contact or target.
- Reusable templates for playlist, blog, radio, YouTube, creator, sync, and fan email.
- Draft quality controls: subject, personalization evidence, release link, CTA, and follow-up date.
- Gmail draft creation and explicit confirmed sending.
- Log drafts, sends, replies, follow-ups, and outcomes.
- Never send bulk outreach automatically.

### Content and assets

- Calendar/list for social posts, emails, teaser videos, artwork, Canvas, visualizer, press assets, and creator assets.
- Statuses: idea, drafted, ready, scheduled, published, blocked.
- Associate every item with release, platform, CTA, asset, copy, owner, and date.
- Asset library with tags, file metadata, rights/use notes, and links.
- Allow manual links where direct platform APIs are unavailable.

### Imports

Preserve dry run, column mapping, row counts, likely duplicate detection, provenance, batch history, and rollback. Never insert blindly. Make fan, industry, organization, and property imports distinct workflows.

### Global search

Search releases, tasks, fans, people, organizations, playlists/properties, interactions, outcomes, assets, and content. Results must be grouped by type and link to useful detail pages.

### AI copilot

AI can:

- summarize today’s work
- explain target ranking
- draft or improve outreach
- generate content options from saved release facts
- summarize a contact/organization history
- suggest follow-ups
- identify missing data and blockers

AI cannot:

- fabricate emails, contacts, relationship history, performance data, or playlist fit
- claim guaranteed placement or coverage
- send without confirmation
- override suppressions or risk blocks

Store prompts, model, timestamp, input references, output, status, and user action in the audited generation table.

## UX requirements

- Premium dark music-tech system.
- Deep blue, violet, restrained magenta, and clear success/warning states.
- Spacious hierarchy, rounded cards, responsive navigation, and useful empty states.
- Desktop and mobile must both support real work.
- Fast perceived performance with skeleton/loading states.
- Accessible labels, focus states, keyboard navigation, and contrast.
- Avoid giant tables as the default experience; tables may exist for power workflows.
- Make completion satisfying through progress, checkmarks, and restrained celebration.

## Acceptance criteria

The rebuild is not complete until:

- full readable source exists in GitHub
- preview deploys automatically from the branch
- sign-in and sign-out work
- all verified data counts are visible through real queries
- no demo records are rendered
- Today produces useful actions from actual records
- playlist records can be searched, filtered, shortlisted, and opened
- fan suppressions are enforced in every sendable workflow
- Gmail can connect, create a real draft, and log it
- Spotify can connect and display a verified connection state
- integration health distinguishes connected, needs action, unavailable, and failed
- task completion, blocker, follow-up, and outreach writes persist
- imports support dry run and rollback
- errors are understandable and recoverable
- lint, typecheck, tests, build, and browser verification pass
- no secret is present in source or client bundles
- the PR includes screenshots, tested flows, env requirements, migrations, and known limitations
