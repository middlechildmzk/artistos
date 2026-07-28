-- Safe fixes identified by Supabase advisors after the ArtistOS integration migration.

create index if not exists content_items_campaign_id_idx
  on public.content_items (campaign_id);

create index if not exists content_items_asset_id_idx
  on public.content_items (asset_id);

create index if not exists content_items_created_by_idx
  on public.content_items (created_by);

-- This trigger only compares OLD and NEW values and does not require elevated privileges.
alter function public.ai_generations_lock_created_by() security invoker;
revoke execute on function public.ai_generations_lock_created_by() from public, anon, authenticated;

-- Avoid re-evaluating auth.uid() for every row.
drop policy if exists ai_generations_read on public.ai_generations;
create policy ai_generations_read
on public.ai_generations
for select
to authenticated
using (created_by = (select auth.uid()));

drop policy if exists ai_generations_insert on public.ai_generations;
create policy ai_generations_insert
on public.ai_generations
for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists ai_generations_update on public.ai_generations;
create policy ai_generations_update
on public.ai_generations
for update
to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));