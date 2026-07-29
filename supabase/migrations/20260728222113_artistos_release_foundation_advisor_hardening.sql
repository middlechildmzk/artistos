drop policy if exists "smart_link_destinations_workspace_manage" on smart_link_destinations;
create policy "smart_link_destinations_workspace_insert" on smart_link_destinations for insert to authenticated
  with check (private.can_manage_workspace(workspace_id));
create policy "smart_link_destinations_workspace_update" on smart_link_destinations for update to authenticated
  using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));
create policy "smart_link_destinations_workspace_delete" on smart_link_destinations for delete to authenticated
  using (private.can_manage_workspace(workspace_id));

drop policy if exists "campaign_deliverables_workspace_manage" on campaign_deliverables;
create policy "campaign_deliverables_workspace_insert" on campaign_deliverables for insert to authenticated
  with check (private.can_manage_workspace(workspace_id));
create policy "campaign_deliverables_workspace_update" on campaign_deliverables for update to authenticated
  using (private.can_manage_workspace(workspace_id)) with check (private.can_manage_workspace(workspace_id));
create policy "campaign_deliverables_workspace_delete" on campaign_deliverables for delete to authenticated
  using (private.can_manage_workspace(workspace_id));

drop policy if exists "fan_consents_workspace_manage" on fan_consents;
create policy "fan_consents_workspace_insert" on fan_consents for insert to authenticated
  with check (private.can_manage_workspace(workspace_id));

drop policy if exists "link_events_workspace_manage" on link_events;
create policy "link_events_workspace_insert" on link_events for insert to authenticated
  with check (private.can_manage_workspace(workspace_id));

create index if not exists idx_smart_links_owner on smart_links(owner_id);
create index if not exists idx_smart_links_release on smart_links(release_id);
create index if not exists idx_smart_link_destinations_workspace on smart_link_destinations(workspace_id);
create index if not exists idx_campaign_deliverables_workspace on campaign_deliverables(workspace_id);
create index if not exists idx_campaign_deliverables_target on campaign_deliverables(campaign_target_id) where campaign_target_id is not null;
create index if not exists idx_evidence_artist on evidence_records(artist_id) where artist_id is not null;
create index if not exists idx_evidence_campaign on evidence_records(campaign_id) where campaign_id is not null;
create index if not exists idx_evidence_campaign_target on evidence_records(campaign_target_id) where campaign_target_id is not null;
create index if not exists idx_evidence_deliverable on evidence_records(deliverable_id) where deliverable_id is not null;
create index if not exists idx_fans_source_smart_link on fans(source_smart_link_id) where source_smart_link_id is not null;
create index if not exists idx_fan_consents_workspace on fan_consents(workspace_id);
create index if not exists idx_fan_consents_smart_link on fan_consents(smart_link_id) where smart_link_id is not null;
create index if not exists idx_link_events_workspace on link_events(workspace_id);
create index if not exists idx_link_events_fan on link_events(fan_id) where fan_id is not null;