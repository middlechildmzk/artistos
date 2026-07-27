-- ArtistOS capability runtime ledger
-- Source-control only in this branch. Apply to a disposable Supabase branch first.

create table if not exists public.capability_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete set null,
  capability_name text not null,
  capability_version integer not null check (capability_version > 0),
  requested_by uuid references auth.users(id) on delete set null,
  request_payload jsonb not null,
  preview_hash text not null,
  preview jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','consumed')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  expires_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.capability_idempotency (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  capability_name text not null,
  capability_version integer not null check (capability_version > 0),
  idempotency_key text not null,
  input_hash text not null,
  result jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, capability_name, capability_version, idempotency_key)
);

create table if not exists public.capability_audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete set null,
  principal_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  capability_name text not null,
  capability_version integer not null check (capability_version > 0),
  risk_class text not null,
  decision text not null check (decision in ('allowed','denied','requires_approval','succeeded','failed')),
  policy_id text,
  idempotency_key text,
  input_hash text,
  output_summary jsonb,
  evidence_ids uuid[] not null default '{}',
  error_code text,
  error_message text,
  run_id uuid,
  step_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists capability_approvals_workspace_status_idx
  on public.capability_approvals (workspace_id, status, created_at desc);
create index if not exists capability_audit_workspace_created_idx
  on public.capability_audit_log (workspace_id, created_at desc);
create index if not exists capability_audit_capability_created_idx
  on public.capability_audit_log (capability_name, created_at desc);

alter table public.capability_approvals enable row level security;
alter table public.capability_idempotency enable row level security;
alter table public.capability_audit_log enable row level security;
revoke all on public.capability_approvals, public.capability_idempotency, public.capability_audit_log from anon;
revoke all on public.capability_approvals, public.capability_idempotency, public.capability_audit_log from authenticated;
grant select, insert, update on public.capability_approvals to authenticated;
grant select, insert on public.capability_idempotency to authenticated;
grant select, insert on public.capability_audit_log to authenticated;

create policy capability_approvals_read on public.capability_approvals
  for select to authenticated using (private.is_workspace_member(workspace_id));
create policy capability_approvals_insert on public.capability_approvals
  for insert to authenticated with check (
    private.is_workspace_member(workspace_id)
    and (requested_by is null or requested_by = (select auth.uid()))
  );
create policy capability_approvals_update on public.capability_approvals
  for update to authenticated using (private.can_manage_workspace(workspace_id))
  with check (private.can_manage_workspace(workspace_id));

create policy capability_idempotency_read on public.capability_idempotency
  for select to authenticated using (private.is_workspace_member(workspace_id));
create policy capability_idempotency_insert on public.capability_idempotency
  for insert to authenticated with check (
    private.can_manage_workspace(workspace_id)
    and (created_by is null or created_by = (select auth.uid()))
  );

create policy capability_audit_read on public.capability_audit_log
  for select to authenticated using (private.is_workspace_member(workspace_id));
create policy capability_audit_insert on public.capability_audit_log
  for insert to authenticated with check (
    private.is_workspace_member(workspace_id)
    and (user_id is null or user_id = (select auth.uid()))
  );

comment on table public.capability_approvals is
  'Human approval requests for permanently gated or policy-gated ArtistOS capabilities.';
comment on table public.capability_idempotency is
  'Durable replay protection for typed ArtistOS capability commands.';
comment on table public.capability_audit_log is
  'Append-only decision and execution receipts for ArtistOS capabilities.';
