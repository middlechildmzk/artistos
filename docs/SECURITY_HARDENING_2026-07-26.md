# ArtistOS Security Hardening

Date: 2026-07-26
Project: Supabase `artistos-core`

## Summary

The live database had RLS enabled on public tables, but many authenticated write policies used unconditional `USING (true)` and/or `WITH CHECK (true)`. The `app` storage bucket was public and allowed anonymous listing, upload, and update. A public `SECURITY DEFINER` workspace helper was executable by anonymous and authenticated roles.

Three production migrations were applied:

- `20260726234539_harden_workspace_rls_and_storage`
- `20260726234616_fix_workspace_membership_policy_recursion`
- `20260726234727_align_authenticated_table_grants_with_rls`

## Changes applied

- Added private workspace membership and workspace management helpers.
- Removed the public workspace helper.
- Replaced broad authenticated policies with workspace-scoped SELECT, INSERT, UPDATE, and DELETE policies.
- Preserved additional user ownership checks on artist platform profiles and OAuth connections.
- Restricted music platform reference data to authenticated read-only access.
- Changed the `app` storage bucket from public to private.
- Removed anonymous storage policies.
- Added workspace-prefixed authenticated storage policies.
- Aligned authenticated table grants with the new RLS policies.
- Replaced recursive membership-owner policy logic with a private owner helper.

## Verification performed

Authenticated simulation for the real BVSS FVM workspace owner:

- 1 visible workspace
- 1 visible membership
- 5,648 visible people
- 3,175 visible fans
- 2 visible releases
- authorized task insert succeeded inside a rolled-back transaction

Authenticated simulation for an unrelated user UUID:

- 0 visible workspaces
- 0 visible memberships
- 0 visible people
- 0 visible fans
- 0 visible releases
- insert into the real workspace failed with an RLS violation

Policy checks after migration:

- unconditional authenticated write policies: 0
- anonymous storage policies: 0
- `app` bucket public state: false

## Remaining security work

- Enable leaked-password protection in Supabase Auth settings.
- Add automated cross-workspace tests to CI.
- Add explicit owner-managed membership invitation and removal policies or server-only RPCs.
- Review every privileged database function after future schema changes.
- Set storage MIME type and file-size limits for audio, artwork, documents, and video.
- Review OAuth token encryption, key rotation, and server-only access paths.
- Rerun Supabase security and performance advisors after each migration.

## Launch gate

Do not invite outside alpha users until authentication, invitation, storage upload, and cross-workspace tests pass against a preview deployment.