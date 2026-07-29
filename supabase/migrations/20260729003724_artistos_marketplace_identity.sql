begin;

create or replace function public.set_artistos_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'artist',
  primary_role text not null default 'artist' check (primary_role in ('artist','professional','hybrid','admin')),
  onboarding_completed boolean not null default false,
  bio text,
  location text,
  avatar_url text,
  current_workspace_id uuid references public.workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_artistos_updated_at();

create or replace function public.handle_artistos_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles (id,email,display_name,role,primary_role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'display_name',''),
    case when new.raw_user_meta_data ->> 'role' = 'curator' then 'professional' else coalesce(nullif(new.raw_user_meta_data ->> 'role',''),'artist') end,
    case when new.raw_user_meta_data ->> 'role' = 'curator' then 'professional' else 'artist' end
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

revoke all on function public.handle_artistos_auth_user() from public;

drop trigger if exists on_artistos_auth_user_created on auth.users;
create trigger on_artistos_auth_user_created
after insert or update of email,raw_user_meta_data on auth.users
for each row execute function public.handle_artistos_auth_user();

insert into public.profiles (id,email,display_name,role,primary_role,current_workspace_id,onboarding_completed)
select
  u.id,
  u.email,
  nullif(u.raw_user_meta_data ->> 'display_name',''),
  case when u.raw_user_meta_data ->> 'role' = 'curator' then 'professional' else coalesce(nullif(u.raw_user_meta_data ->> 'role',''),'artist') end,
  case when u.raw_user_meta_data ->> 'role' = 'curator' then 'professional' else 'artist' end,
  wm.workspace_id,
  false
from auth.users u
left join lateral (
  select workspace_id from public.workspace_members
  where user_id = u.id
  order by created_at
  limit 1
) wm on true
on conflict (id) do update set
  email = excluded.email,
  current_workspace_id = coalesce(public.profiles.current_workspace_id, excluded.current_workspace_id);

create table if not exists public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  public_slug text not null unique,
  display_name text not null,
  professional_types text[] not null default '{}'::text[],
  bio text,
  location text,
  website text,
  review_mode text not null default 'editorial_only' check (review_mode in ('editorial_only','free_feedback','paid_review','sponsored_services')),
  review_fee_cents integer not null default 0 check (review_fee_cents >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  turnaround_days integer check (turnaround_days is null or turnaround_days between 1 and 90),
  capacity_status text not null default 'open' check (capacity_status in ('open','limited','paused')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professional_profiles_workspace_idx on public.professional_profiles(workspace_id);
create index if not exists professional_profiles_public_idx on public.professional_profiles(is_public,capacity_status);

alter table public.professional_profiles enable row level security;

drop policy if exists professional_profiles_public_or_own on public.professional_profiles;
create policy professional_profiles_public_or_own on public.professional_profiles
for select using (is_public or user_id = auth.uid());

drop policy if exists professional_profiles_insert_own on public.professional_profiles;
create policy professional_profiles_insert_own on public.professional_profiles
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = professional_profiles.workspace_id and wm.user_id = auth.uid()
  )
);

drop policy if exists professional_profiles_update_own on public.professional_profiles;
create policy professional_profiles_update_own on public.professional_profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists professional_profiles_set_updated_at on public.professional_profiles;
create trigger professional_profiles_set_updated_at before update on public.professional_profiles
for each row execute function public.set_artistos_updated_at();

create table if not exists public.property_claims (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  professional_profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  claimant_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  verification_method text not null default 'manual' check (verification_method in ('oauth','domain_email','website_token','social_profile','manual')),
  evidence_url text,
  evidence_notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists property_claims_one_open_claim_idx
on public.property_claims(property_id,claimant_user_id)
where status in ('pending','approved');
create index if not exists property_claims_profile_idx on public.property_claims(professional_profile_id,status);

alter table public.property_claims enable row level security;

drop policy if exists property_claims_own_select on public.property_claims;
create policy property_claims_own_select on public.property_claims
for select using (claimant_user_id = auth.uid());

drop policy if exists property_claims_own_insert on public.property_claims;
create policy property_claims_own_insert on public.property_claims
for insert with check (
  claimant_user_id = auth.uid()
  and exists (
    select 1 from public.professional_profiles pp
    where pp.id = property_claims.professional_profile_id and pp.user_id = auth.uid()
  )
);

drop policy if exists property_claims_own_update on public.property_claims;
create policy property_claims_own_update on public.property_claims
for update using (claimant_user_id = auth.uid())
with check (claimant_user_id = auth.uid() and status in ('pending','withdrawn'));

drop trigger if exists property_claims_set_updated_at on public.property_claims;
create trigger property_claims_set_updated_at before update on public.property_claims
for each row execute function public.set_artistos_updated_at();

create table if not exists public.professional_properties (
  professional_profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','operator','editor','reviewer')),
  status text not null default 'active' check (status in ('pending','active','revoked')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (professional_profile_id,property_id)
);

create index if not exists professional_properties_property_idx on public.professional_properties(property_id,status);

alter table public.professional_properties enable row level security;

drop policy if exists professional_properties_public_select on public.professional_properties;
create policy professional_properties_public_select on public.professional_properties
for select using (
  status = 'active'
  or exists (
    select 1 from public.professional_profiles pp
    where pp.id = professional_properties.professional_profile_id and pp.user_id = auth.uid()
  )
);

drop policy if exists professional_properties_own_manage on public.professional_properties;
create policy professional_properties_own_manage on public.professional_properties
for all using (
  exists (
    select 1 from public.professional_profiles pp
    where pp.id = professional_properties.professional_profile_id and pp.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.professional_profiles pp
    where pp.id = professional_properties.professional_profile_id and pp.user_id = auth.uid()
  )
);

create table if not exists public.campaign_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  campaign_target_id uuid not null unique references public.campaign_targets(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  professional_profile_id uuid references public.professional_profiles(id) on delete set null,
  submission_mode text not null default 'marketplace' check (submission_mode in ('marketplace','outreach')),
  status text not null default 'draft' check (status in ('draft','invited','pending_review','in_review','accepted','declined','feedback_submitted','promotion_committed','completed','withdrawn')),
  match_score integer not null default 0 check (match_score between 0 and 100),
  match_reasons jsonb not null default '[]'::jsonb,
  artist_message text,
  fee_cents integer not null default 0 check (fee_cents >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  terms jsonb not null default '{}'::jsonb,
  response_due_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_submissions_campaign_idx on public.campaign_submissions(campaign_id,status);
create index if not exists campaign_submissions_professional_idx on public.campaign_submissions(professional_profile_id,status,created_at desc);
create index if not exists campaign_submissions_property_idx on public.campaign_submissions(property_id,status);

alter table public.campaign_submissions enable row level security;

drop policy if exists campaign_submissions_participant_select on public.campaign_submissions;
create policy campaign_submissions_participant_select on public.campaign_submissions
for select using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = campaign_submissions.workspace_id and wm.user_id = auth.uid()
  )
  or exists (
    select 1 from public.professional_profiles pp
    where pp.id = campaign_submissions.professional_profile_id and pp.user_id = auth.uid()
  )
);

drop policy if exists campaign_submissions_artist_insert on public.campaign_submissions;
create policy campaign_submissions_artist_insert on public.campaign_submissions
for insert with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = campaign_submissions.workspace_id and wm.user_id = auth.uid()
      and wm.role::text in ('owner','admin','editor')
  )
);

drop policy if exists campaign_submissions_participant_update on public.campaign_submissions;
create policy campaign_submissions_participant_update on public.campaign_submissions
for update using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = campaign_submissions.workspace_id and wm.user_id = auth.uid()
      and wm.role::text in ('owner','admin','editor')
  )
  or exists (
    select 1 from public.professional_profiles pp
    where pp.id = campaign_submissions.professional_profile_id and pp.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = campaign_submissions.workspace_id and wm.user_id = auth.uid()
  )
  or exists (
    select 1 from public.professional_profiles pp
    where pp.id = campaign_submissions.professional_profile_id and pp.user_id = auth.uid()
  )
);

drop trigger if exists campaign_submissions_set_updated_at on public.campaign_submissions;
create trigger campaign_submissions_set_updated_at before update on public.campaign_submissions
for each row execute function public.set_artistos_updated_at();

create table if not exists public.submission_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.campaign_submissions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('not_a_fit','feedback_only','considering','accepted','promotion_offered')),
  rating integer check (rating is null or rating between 1 and 5),
  feedback_text text not null,
  promotion_intent boolean not null default false,
  proposed_deliverable jsonb not null default '{}'::jsonb,
  disclosure_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.submission_feedback enable row level security;

drop policy if exists submission_feedback_participant_select on public.submission_feedback;
create policy submission_feedback_participant_select on public.submission_feedback
for select using (
  exists (
    select 1 from public.campaign_submissions cs
    where cs.id = submission_feedback.submission_id
      and (
        exists (select 1 from public.workspace_members wm where wm.workspace_id = cs.workspace_id and wm.user_id = auth.uid())
        or exists (select 1 from public.professional_profiles pp where pp.id = cs.professional_profile_id and pp.user_id = auth.uid())
      )
  )
);

drop policy if exists submission_feedback_professional_insert on public.submission_feedback;
create policy submission_feedback_professional_insert on public.submission_feedback
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.campaign_submissions cs
    join public.professional_profiles pp on pp.id = cs.professional_profile_id
    where cs.id = submission_feedback.submission_id and pp.user_id = auth.uid()
  )
);

drop policy if exists submission_feedback_professional_update on public.submission_feedback;
create policy submission_feedback_professional_update on public.submission_feedback
for update using (created_by = auth.uid()) with check (created_by = auth.uid());

drop trigger if exists submission_feedback_set_updated_at on public.submission_feedback;
create trigger submission_feedback_set_updated_at before update on public.submission_feedback
for each row execute function public.set_artistos_updated_at();

create table if not exists public.submission_messages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.campaign_submissions(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists submission_messages_submission_idx on public.submission_messages(submission_id,created_at);

alter table public.submission_messages enable row level security;

drop policy if exists submission_messages_participant_select on public.submission_messages;
create policy submission_messages_participant_select on public.submission_messages
for select using (
  exists (
    select 1 from public.campaign_submissions cs
    where cs.id = submission_messages.submission_id
      and (
        exists (select 1 from public.workspace_members wm where wm.workspace_id = cs.workspace_id and wm.user_id = auth.uid())
        or exists (select 1 from public.professional_profiles pp where pp.id = cs.professional_profile_id and pp.user_id = auth.uid())
      )
  )
);

drop policy if exists submission_messages_participant_insert on public.submission_messages;
create policy submission_messages_participant_insert on public.submission_messages
for insert with check (
  sender_user_id = auth.uid()
  and exists (
    select 1 from public.campaign_submissions cs
    where cs.id = submission_messages.submission_id
      and (
        exists (select 1 from public.workspace_members wm where wm.workspace_id = cs.workspace_id and wm.user_id = auth.uid())
        or exists (select 1 from public.professional_profiles pp where pp.id = cs.professional_profile_id and pp.user_id = auth.uid())
      )
  )
);

commit;