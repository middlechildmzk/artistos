alter table public.content_items
  add column if not exists post_type text,
  add column if not exists hook text,
  add column if not exists hashtags text,
  add column if not exists aspect_ratio text,
  add column if not exists approval_state text not null default 'draft',
  add column if not exists source_content text,
  add column if not exists engagement jsonb not null default '{}'::jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists parent_content_id uuid references public.content_items(id) on delete set null;

do $$ begin
  alter table public.content_items
    add constraint content_items_approval_state_check
    check (approval_state in ('draft','review','approved','rejected'));
exception when duplicate_object then null;
end $$;

create index if not exists content_items_status_schedule_idx
  on public.content_items (status, scheduled_for);
create index if not exists content_items_parent_idx
  on public.content_items (parent_content_id);

create table if not exists public.campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.releases(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  platform text not null,
  metric_date date not null,
  source_type text not null default 'manual' check (source_type in ('manual','csv','api')),
  metrics jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaign_metrics enable row level security;
revoke all on public.campaign_metrics from anon;
grant select, insert, update, delete on public.campaign_metrics to authenticated;

drop policy if exists "Users manage their own campaign metrics" on public.campaign_metrics;
create policy "Users manage their own campaign metrics"
on public.campaign_metrics
for all
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);

create index if not exists campaign_metrics_release_date_idx
  on public.campaign_metrics (release_id, metric_date desc);