-- Manual rollback for 20260929220000_harden_professional_identity_privileges.
-- Restores the exact pre-migration grants and policies captured from production
-- on 2026-09-29. Re-opens the privilege paths the migration closed; use only to
-- unblock an incident, then re-apply the forward migration.
-- Not a migration: never place in supabase/migrations.

grant insert, update, delete on public.professional_profiles to anon, authenticated;
grant insert, update, delete on public.professional_properties to anon, authenticated;
grant insert, update, delete on public.property_claims to anon, authenticated;

create policy professional_properties_insert_own on public.professional_properties
  for insert to public
  with check (exists (select 1 from public.professional_profiles pp
    where pp.id = professional_properties.professional_profile_id and pp.user_id = (select auth.uid())));
create policy professional_properties_update_own on public.professional_properties
  for update to public
  using (exists (select 1 from public.professional_profiles pp
    where pp.id = professional_properties.professional_profile_id and pp.user_id = (select auth.uid())))
  with check (exists (select 1 from public.professional_profiles pp
    where pp.id = professional_properties.professional_profile_id and pp.user_id = (select auth.uid())));

drop policy if exists property_claims_own_update on public.property_claims;
create policy property_claims_own_update on public.property_claims
  for update to public
  using (claimant_user_id = (select auth.uid()))
  with check (claimant_user_id = (select auth.uid()) and status = any (array['pending'::text, 'withdrawn'::text]));
