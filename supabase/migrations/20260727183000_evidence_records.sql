-- ArtistOS evidence spine
-- Source-control only. Replay on a disposable Supabase branch before production.

create table if not exists public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete set null,
  evidence_type text not null,
  source_type text not null check (source_type in ('url','api_response','uploaded_file','human_attestation','system_observation')),
  source_uri text,
  summary text not null,
  confidence text not null check (confidence in ('verified','supported','weak','unknown')),
  observed_at timestamptz not null,
  captured_at timestamptz not null default now(),
  captured_by uuid references auth.users(id) on delete set null,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  supersedes_id uuid references public.evidence_records(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text
);

create index if not exists evidence_records_workspace_observed_idx
  on public.evidence_records (workspace_id, observed_at desc);
create index if not exists evidence_records_type_observed_idx
  on public.evidence_records (evidence_type, observed_at desc);
create index if not exists evidence_records_source_uri_idx
  on public.evidence_records (source_uri) where source_uri is not null;

alter table public.evidence_records enable row level security;
revoke all on public.evidence_records from anon;
revoke all on public.evidence_records from authenticated;
grant select, insert on public.evidence_records to authenticated;

create policy evidence_records_read on public.evidence_records
  for select to authenticated using (private.is_workspace_member(workspace_id));

create policy evidence_records_insert on public.evidence_records
  for insert to authenticated with check (
    private.is_workspace_member(workspace_id)
    and (captured_by is null or captured_by = (select auth.uid()))
  );

comment on table public.evidence_records is
  'Append-oriented evidence objects supporting capability execution, memory claims, outcomes, and evaluations.';
comment on column public.evidence_records.supersedes_id is
  'Preserves lineage when newer evidence replaces or corrects an earlier record without mutating history.';
