# First Free Tool: Spotify Pitch Builder

## Objective

Deliver a useful anonymous pitch-building experience that converts naturally into an ArtistOS account and release workspace.

## Anonymous inputs

- Artist name
- Track title
- Featured artist
- Primary and secondary genre
- Mood
- Instruments and production traits
- Track story
- Intended listener or use case
- Comparable artists, optional
- Promotion plan, optional
- Release date, optional

## Output

- Primary pitch under the current Spotify for Artists character limit
- Character count
- One more emotional alternative
- One more concise editorial alternative
- Missing-information warnings
- Unsupported-claim warnings
- Copy button

## Trust rules

- Do not invent prior support, listener totals, press, playlists, collaborators, or marketing commitments.
- Clearly label user-provided claims.
- Never guarantee editorial placement.
- Keep medical, trauma, faith, or personal-story language under the artist's control.
- Preserve exact artist and featured-artist styling.

## Conversion

Anonymous users receive the complete draft. Account creation is requested only to:

- save the pitch
- create the release workspace
- reuse artist identity and brand memory
- generate related campaign copy
- track pitch submission and release outcomes

## Logged-in enhancement

When a release exists, prefill verified release facts and save approved versions into `ai_generations` or a dedicated generation/output record linked to the release and workspace.

## Analytics

- tool_viewed
- tool_started
- tool_completed
- pitch_copied
- save_clicked
- signup_started
- signup_completed
- release_created_from_tool
- output_reused

## Acceptance criteria

- Works without authentication.
- Returns at least one valid pitch and exact character count.
- Does not invent facts.
- Offers save-to-ArtistOS after delivering value.
- Logged-in users can attach the output to a release.
- Mobile accessible.
