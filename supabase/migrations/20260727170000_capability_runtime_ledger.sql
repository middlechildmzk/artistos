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
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','executing','consumed','failed')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  expires_at timestamptz,
  decision_note text,
  execution_error text,
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

create or replace function public.decide_capability_approval(
  p_approval_id uuid,
  p_decision text,
  p_note text default null
) returns public.capability_approvals
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  claimed public.capability_approvals;
begin
  if p_decision not in ('approved','rejected') then
    raise exception 'invalid_approval_decision';
  end if;

  update public.capability_approvals
  set status = p_decision,
      decided_by = (select auth.uid()),
      decided_at = now(),
      decision_note = nullif(trim(p_note), ''),
      updated_at = now()
  where id = p_approval_id
    and status = 'pending'
    and private.can_manage_workspace(workspace_id)
    and (expires_at is null or expires_at > now())
  returning * into claimed;

  if claimed.id is null then
    raise exception 'approval_not_pending_or_not_authorized';
  end if;
  return claimed;
end;
$$;

create or replace function public.claim_capability_approval(p_approval_id uuid)
returns public.capability_approvals
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  claimed public.capability_approvals;
begin
  update public.capability_approvals
  set status = 'executing', updated_at = now()
  where id = p_approval_id
    and status = 'approved'
    and private.can_manage_workspace(workspace_id)
    and (expires_at is null or expires_at > now())
  returning * into claimed;

  if claimed.id is null then
    raise exception 'approval_not_claimable';
  end if;
  return claimed;
end;
$$;

create or replace function public.finish_capability_approval(
  p_approval_id uuid,
  p_status text,
  p_error text default null
) returns public.capability_approvals
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  finished public.capability_approvals;
begin
  if p_status not in ('consumed','failed') then
    raise exception 'invalid_completion_status';
  end if;

  update public.capability_approvals
  set status = p_status,
      execution_error = case when p_status = 'failed' then p_error else null end,
      updated_at = now()
  where id = p_approval_id
    and status = 'executing'
    and private.can_manage_workspace(workspace_id)
  returning * into finished;

  if finished.id is null then
    raise exception 'approval_not_executing';
  end if;
  return finished;
end;
$$;

revoke all on function public.decide_capability_approval(uuid,text,text) from public, anon;
revoke all on function public.claim_capability_approval(uuid) from public, anon;
revoke all on function public.finish_capability_approval(uuid,text,text) from public, anon;
grant execute on function public.decide_capability_approval(uuid,text,text) to authenticated;
grant execute on function public.claim_capability_approval(uuid) to authenticated;
grant execute on function public.finish_capability_approval(uuid,text,text) to authenticated;

comment on table public.capability_approvals is
  'Human approval requests for permanently gated or policy-gated ArtistOS capabilities.';
comment on table public.capability_idempotency is
  'Durable replay protection for typed ArtistOS capability commands.';
comment on table public.capability_audit_log is
  'Append-only decision and execution receipts for ArtistOS capabilities.';
