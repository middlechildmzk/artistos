-- T1B security correction: close self-promotion paths on ArtistOS professional
-- identity, property ownership and property claims.
--
-- Verified 2026-09-29 against production (all three tables had 0 rows, so no
-- existing data is affected and nothing was exploited):
--   * anon and authenticated held table-wide INSERT/UPDATE on every column, and
--     RLS does not restrict columns. A signed-in user could therefore:
--       - INSERT professional_properties linking their profile to ANY property as
--         role 'owner', status 'active', verified_at now()  (skipping claims);
--       - UPDATE their own professional_profiles.verification_status to 'verified'
--         or INSERT a new profile already 'verified';
--       - INSERT a property_claims row already 'approved' with reviewer fields;
--       - reopen a rejected claim by updating it back to 'pending'.
--
-- After this migration:
--   * professional_profiles: self-service columns only; verification_status,
--     identity and workspace columns are not client-writable.
--   * professional_properties: ownership links are created and changed only by
--     the service role (the approval path). Owners may still DELETE their own
--     link (self-unlink).
--   * property_claims: claimants may file a claim and withdraw or annotate a
--     PENDING claim. status on insert always defaults to 'pending'; review
--     fields are not client-writable.
--   * anon writes nothing on these tables.
--
-- No application code writes these tables today (checked 2026-09-29), so rule 8
-- of supabase/migrations/README.md is satisfied: there is no existing writer to
-- migrate first. Approval and verification remain service-role only until T2
-- introduces an audited transition function.
--
-- Rollback: see supabase/rollback/20260929220000_harden_professional_identity_privileges.down.sql

-- anon never writes professional identity or claims.
revoke insert, update, delete on public.professional_profiles from anon;
revoke insert, update, delete on public.professional_properties from anon;
revoke insert, update, delete on public.property_claims from anon;

-- professional_profiles: column-scoped self-service.
revoke insert, update on public.professional_profiles from authenticated;
grant insert (
  user_id, workspace_id, public_slug, display_name, professional_types, bio,
  location, website, review_mode, review_fee_cents, currency, turnaround_days,
  capacity_status, is_public
) on public.professional_profiles to authenticated;
grant update (
  public_slug, display_name, professional_types, bio, location, website,
  review_mode, review_fee_cents, currency, turnaround_days, capacity_status,
  is_public
) on public.professional_profiles to authenticated;

-- professional_properties: no client-created or client-promoted ownership.
revoke insert, update on public.professional_properties from authenticated;
drop policy if exists professional_properties_insert_own on public.professional_properties;
drop policy if exists professional_properties_update_own on public.professional_properties;

-- property_claims: file, annotate and withdraw pending claims only.
revoke insert, update on public.property_claims from authenticated;
grant insert (
  property_id, claimant_user_id, professional_profile_id, claimant_workspace_id,
  verification_method, evidence_url, evidence_notes
) on public.property_claims to authenticated;
grant update (status, evidence_url, evidence_notes) on public.property_claims to authenticated;

drop policy if exists property_claims_own_update on public.property_claims;
create policy property_claims_own_update on public.property_claims
  for update to authenticated
  using (claimant_user_id = (select auth.uid()) and status = 'pending')
  with check (claimant_user_id = (select auth.uid()) and status = any (array['pending'::text, 'withdrawn'::text]));
