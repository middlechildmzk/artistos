update storage.buckets
set file_size_limit = 262144000,
    allowed_mime_types = array[
      'audio/mpeg','audio/wav','audio/x-wav','audio/flac','audio/mp4','audio/aac',
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/quicktime','video/webm',
      'application/pdf','text/plain','text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'app';

create index if not exists releases_artist_id_idx on public.releases(artist_id);
create index if not exists campaigns_release_id_idx on public.campaigns(release_id);
create index if not exists tasks_release_id_idx on public.tasks(release_id);
create index if not exists tasks_campaign_id_idx on public.tasks(campaign_id);
create index if not exists interactions_campaign_id_idx on public.interactions(campaign_id);
create index if not exists interactions_organization_id_idx on public.interactions(organization_id);
create index if not exists interactions_person_id_idx on public.interactions(person_id);
create index if not exists people_organization_id_idx on public.people(organization_id);
create index if not exists properties_organization_id_idx on public.properties(organization_id);
create index if not exists submission_endpoints_organization_id_idx on public.submission_endpoints(organization_id);
create index if not exists outcomes_campaign_id_idx on public.outcomes(campaign_id);
create index if not exists outcomes_release_id_idx on public.outcomes(release_id);
create index if not exists outcomes_organization_id_idx on public.outcomes(organization_id);
create index if not exists relationship_signals_organization_id_idx on public.relationship_signals(organization_id);
create index if not exists risk_events_organization_id_idx on public.risk_events(organization_id);
create index if not exists assets_release_id_idx on public.assets(release_id);
create index if not exists assets_artist_id_idx on public.assets(artist_id);
