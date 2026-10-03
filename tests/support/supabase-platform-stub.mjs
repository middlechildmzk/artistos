// Minimal stand-in for the platform objects Supabase provides before any
// project migration runs: roles, the auth schema, and the storage schema.
// Only the surface the artistos-core migrations actually reference is stubbed.
// auth.uid() reads request.jwt.claim.sub exactly like Supabase's own function,
// so RLS policies behave as they do in production when a test sets that claim.

export const SUPABASE_PLATFORM_STUB = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema if not exists extensions;
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create extension if not exists pgcrypto;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud varchar(255),
  role varchar(255),
  email text,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  updated_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')::text
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
create or replace function storage.filename(name text) returns text language sql immutable as $$
  select split_part(name, '/', -1)
$$;
create or replace function storage.extension(name text) returns text language sql immutable as $$
  select split_part(split_part(name, '/', -1), '.', -1)
$$;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
`;

/** Run SQL as a Supabase API role with a given JWT subject, then reset. */
export async function asRole(db, role, userId, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false); select set_config('request.jwt.claim.role', '${role}', false); set role ${role};`);
  try {
    return params ? await db.query(sql, params) : await db.exec(sql);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
