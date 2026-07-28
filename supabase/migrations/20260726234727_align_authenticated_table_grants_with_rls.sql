begin;
do $$
declare t text;
  tables text[] := array[
    'ai_generations','artist_platform_profiles','artists','assets','campaign_metrics',
    'campaign_targets','campaigns','content_items','fans','import_batches',
    'import_row_actions','interactions','music_coverage_events','music_metric_snapshots',
    'oauth_connections','organizations','outcomes','people','playlist_placements',
    'properties','relationship_signals','release_platform_links','releases','risk_events',
    'source_records','submission_endpoints','suppressions','tasks','verification_events'
  ];
begin
  foreach t in array tables loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;
revoke insert, update, delete, truncate on public.music_platforms from authenticated;
grant select on public.music_platforms to authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
commit;
