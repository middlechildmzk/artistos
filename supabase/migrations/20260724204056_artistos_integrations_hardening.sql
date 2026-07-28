-- Tighten grants for ArtistOS-owned integration tables and remove a redundant index.

revoke all on table public.oauth_connections from authenticated;
grant select, insert, update, delete on table public.oauth_connections to authenticated;

revoke all on table public.content_items from authenticated;
grant select, insert, update, delete on table public.content_items to authenticated;

-- The unique (user_id, provider) constraint already provides an equivalent btree index.
drop index if exists public.oauth_connections_user_provider_idx;