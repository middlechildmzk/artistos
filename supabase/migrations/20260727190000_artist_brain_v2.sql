-- ArtistOS Artist Brain v2
-- Source-controlled only. Replay on a disposable Supabase branch before production.

create table if not exists public.brain_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  memory_class text not null check (memory_class in ('semantic','episodic','learned')),
  namespace text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  summary text,
  source_kind text not null default 'human' check (source_kind in ('human','import','capability','integration','inference','evaluation')),
  confidence text not null default 'supported' check (confidence in ('verified','supported','weak','unknown','stale','conflicting')),
  freshness_status text not null default 'current' check (freshness_status in ('current','aging','stale','unknown')),
  observed_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  supersedes_memory_id uuid references public.brain_memories(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brain_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  memory_id uuid references public.brain_memories(id) on delete cascade,
  claim_type text not null,
  subject_ref text,
  predicate text not null,
  object_value jsonb not null,
  confidence text not null default 'supported' check (confidence in ('verified','supported','weak','unknown','stale','conflicting')),
  contradiction_state text not null default 'none' check (contradiction_state in ('none','possible','confirmed','resolved')),
  review_status text not null default 'pending' check (review_status in ('pending','accepted','rejected','needs_evidence','superseded')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  source_retrieved_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brain_claim_evidence (
  claim_id uuid not null references public.brain_claims(id) on delete cascade,
  evidence_id uuid not null references public.evidence_records(id) on delete restrict,
  relationship text not null default 'supports' check (relationship in ('supports','contradicts','qualifies','supersedes')),
  created_at timestamptz not null default now(),
  primary key (claim_id, evidence_id, relationship)
);

create table if not exists public.brain_learning_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete cascade,
  metric_key text not null,
  dimension jsonb not null default '{}'::jsonb,
  sample_size integer not null default 0 check (sample_size >= 0),
  metric_value numeric,
  baseline_value numeric,
  effect_size numeric,
  confidence text not null default 'weak' check (confidence in ('verified','supported','weak','unknown','stale','conflicting')),
  evidence_ids uuid[] not null default '{}',
  observed_from timestamptz,
  observed_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists brain_memories_workspace_class_idx on public.brain_memories(workspace_id,memory_class,created_at desc);
create index if not exists brain_claims_workspace_review_idx on public.brain_claims(workspace_id,review_status,created_at desc);
create index if not exists brain_claims_memory_idx on public.brain_claims(memory_id);
create index if not exists brain_learning_workspace_metric_idx on public.brain_learning_observations(workspace_id,metric_key,created_at desc);

alter table public.brain_memories enable row level security;
alter table public.brain_claims enable row level security;
alter table public.brain_claim_evidence enable row level security;
alter table public.brain_learning_observations enable row level security;

revoke all on public.brain_memories, public.brain_claims, public.brain_claim_evidence, public.brain_learning_observations from anon;
grant select, insert, update on public.brain_memories, public.brain_claims to authenticated;
grant select, insert on public.brain_claim_evidence, public.brain_learning_observations to authenticated;

create policy brain_memories_read on public.brain_memories for select to authenticated using (private.is_workspace_member(workspace_id));
create policy brain_memories_insert on public.brain_memories for insert to authenticated with check (private.is_workspace_member(workspace_id) and (created_by is null or created_by = (select auth.uid())));
create policy brain_memories_update on public.brain_memories for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));
create policy brain_claims_read on public.brain_claims for select to authenticated using (private.is_workspace_member(workspace_id));
create policy brain_claims_insert on public.brain_claims for insert to authenticated with check (private.is_workspace_member(workspace_id) and (created_by is null or created_by = (select auth.uid())));
create policy brain_claims_update on public.brain_claims for update to authenticated using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));
create policy brain_claim_evidence_read on public.brain_claim_evidence for select to authenticated using (exists (select 1 from public.brain_claims c where c.id = claim_id and private.is_workspace_member(c.workspace_id)));
create policy brain_claim_evidence_insert on public.brain_claim_evidence for insert to authenticated with check (exists (select 1 from public.brain_claims c where c.id = claim_id and private.is_workspace_member(c.workspace_id)));
create policy brain_learning_read on public.brain_learning_observations for select to authenticated using (private.is_workspace_member(workspace_id));
create policy brain_learning_insert on public.brain_learning_observations for insert to authenticated with check (private.is_workspace_member(workspace_id));

comment on table public.brain_memories is 'Versioned semantic, episodic, and learned memories for the Artist Brain.';
comment on table public.brain_claims is 'Reviewable evidence-backed claims derived from memory, integrations, humans, or inference.';
comment on table public.brain_claim_evidence is 'Explicit support, contradiction, qualification, and supersession links between claims and evidence.';
comment on table public.brain_learning_observations is 'Measured observations that may support learned Artist Brain insights without prematurely promoting them to fact.';