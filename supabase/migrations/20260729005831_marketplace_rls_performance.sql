begin;

create index if not exists profiles_current_workspace_idx on public.profiles(current_workspace_id);
create index if not exists artist_platform_profiles_platform_idx on public.artist_platform_profiles(platform_id);
create index if not exists campaign_submissions_workspace_created_idx on public.campaign_submissions(workspace_id,created_at desc);
create index if not exists campaign_submissions_release_idx on public.campaign_submissions(release_id);
create index if not exists property_claims_claimant_idx on public.property_claims(claimant_user_id,status);
create index if not exists property_claims_workspace_idx on public.property_claims(claimant_workspace_id);
create index if not exists property_claims_reviewer_idx on public.property_claims(reviewed_by) where reviewed_by is not null;
create index if not exists submission_feedback_created_by_idx on public.submission_feedback(created_by);
create index if not exists submission_messages_sender_idx on public.submission_messages(sender_user_id);

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using ((select auth.uid()) = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check ((select auth.uid()) = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists professional_profiles_public_or_own on public.professional_profiles;
create policy professional_profiles_public_or_own on public.professional_profiles for select using (is_public or user_id = (select auth.uid()));
drop policy if exists professional_profiles_insert_own on public.professional_profiles;
create policy professional_profiles_insert_own on public.professional_profiles for insert with check (user_id = (select auth.uid()) and exists (select 1 from public.workspace_members wm where wm.workspace_id = professional_profiles.workspace_id and wm.user_id = (select auth.uid())));
drop policy if exists professional_profiles_update_own on public.professional_profiles;
create policy professional_profiles_update_own on public.professional_profiles for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists property_claims_own_select on public.property_claims;
create policy property_claims_own_select on public.property_claims for select using (claimant_user_id = (select auth.uid()));
drop policy if exists property_claims_own_insert on public.property_claims;
create policy property_claims_own_insert on public.property_claims for insert with check (claimant_user_id = (select auth.uid()) and exists (select 1 from public.professional_profiles pp where pp.id = property_claims.professional_profile_id and pp.user_id = (select auth.uid())));
drop policy if exists property_claims_own_update on public.property_claims;
create policy property_claims_own_update on public.property_claims for update using (claimant_user_id = (select auth.uid())) with check (claimant_user_id = (select auth.uid()) and status in ('pending','withdrawn'));

drop policy if exists professional_properties_public_select on public.professional_properties;
drop policy if exists professional_properties_own_manage on public.professional_properties;
create policy professional_properties_select on public.professional_properties for select using (status = 'active' or exists (select 1 from public.professional_profiles pp where pp.id = professional_properties.professional_profile_id and pp.user_id = (select auth.uid())));
create policy professional_properties_insert_own on public.professional_properties for insert with check (exists (select 1 from public.professional_profiles pp where pp.id = professional_properties.professional_profile_id and pp.user_id = (select auth.uid())));
create policy professional_properties_update_own on public.professional_properties for update using (exists (select 1 from public.professional_profiles pp where pp.id = professional_properties.professional_profile_id and pp.user_id = (select auth.uid()))) with check (exists (select 1 from public.professional_profiles pp where pp.id = professional_properties.professional_profile_id and pp.user_id = (select auth.uid())));
create policy professional_properties_delete_own on public.professional_properties for delete using (exists (select 1 from public.professional_profiles pp where pp.id = professional_properties.professional_profile_id and pp.user_id = (select auth.uid())));

drop policy if exists campaign_submissions_participant_select on public.campaign_submissions;
create policy campaign_submissions_participant_select on public.campaign_submissions for select using (exists (select 1 from public.workspace_members wm where wm.workspace_id = campaign_submissions.workspace_id and wm.user_id = (select auth.uid())) or exists (select 1 from public.professional_profiles pp where pp.id = campaign_submissions.professional_profile_id and pp.user_id = (select auth.uid())));
drop policy if exists campaign_submissions_artist_insert on public.campaign_submissions;
create policy campaign_submissions_artist_insert on public.campaign_submissions for insert with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = campaign_submissions.workspace_id and wm.user_id = (select auth.uid()) and wm.role::text in ('owner','admin','editor')));
drop policy if exists campaign_submissions_participant_update on public.campaign_submissions;
create policy campaign_submissions_participant_update on public.campaign_submissions for update using (exists (select 1 from public.workspace_members wm where wm.workspace_id = campaign_submissions.workspace_id and wm.user_id = (select auth.uid()) and wm.role::text in ('owner','admin','editor')) or exists (select 1 from public.professional_profiles pp where pp.id = campaign_submissions.professional_profile_id and pp.user_id = (select auth.uid()))) with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = campaign_submissions.workspace_id and wm.user_id = (select auth.uid())) or exists (select 1 from public.professional_profiles pp where pp.id = campaign_submissions.professional_profile_id and pp.user_id = (select auth.uid())));

drop policy if exists submission_feedback_participant_select on public.submission_feedback;
create policy submission_feedback_participant_select on public.submission_feedback for select using (exists (select 1 from public.campaign_submissions cs where cs.id = submission_feedback.submission_id and (exists (select 1 from public.workspace_members wm where wm.workspace_id = cs.workspace_id and wm.user_id = (select auth.uid())) or exists (select 1 from public.professional_profiles pp where pp.id = cs.professional_profile_id and pp.user_id = (select auth.uid())))));
drop policy if exists submission_feedback_professional_insert on public.submission_feedback;
create policy submission_feedback_professional_insert on public.submission_feedback for insert with check (created_by = (select auth.uid()) and exists (select 1 from public.campaign_submissions cs join public.professional_profiles pp on pp.id = cs.professional_profile_id where cs.id = submission_feedback.submission_id and pp.user_id = (select auth.uid())));
drop policy if exists submission_feedback_professional_update on public.submission_feedback;
create policy submission_feedback_professional_update on public.submission_feedback for update using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy if exists submission_messages_participant_select on public.submission_messages;
create policy submission_messages_participant_select on public.submission_messages for select using (exists (select 1 from public.campaign_submissions cs where cs.id = submission_messages.submission_id and (exists (select 1 from public.workspace_members wm where wm.workspace_id = cs.workspace_id and wm.user_id = (select auth.uid())) or exists (select 1 from public.professional_profiles pp where pp.id = cs.professional_profile_id and pp.user_id = (select auth.uid())))));
drop policy if exists submission_messages_participant_insert on public.submission_messages;
create policy submission_messages_participant_insert on public.submission_messages for insert with check (sender_user_id = (select auth.uid()) and exists (select 1 from public.campaign_submissions cs where cs.id = submission_messages.submission_id and (exists (select 1 from public.workspace_members wm where wm.workspace_id = cs.workspace_id and wm.user_id = (select auth.uid())) or exists (select 1 from public.professional_profiles pp where pp.id = cs.professional_profile_id and pp.user_id = (select auth.uid())))));

commit;