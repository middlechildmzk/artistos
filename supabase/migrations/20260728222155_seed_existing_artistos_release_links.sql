update releases
set featured_artist = 'lowly sunday', upc = '882877618355'
where title = 'Never Alone'
  and artist_id in (select id from artists where name = 'Middle Child');

with release_rows as (
  select
    r.id as release_id,
    r.workspace_id,
    a.name as artist_name,
    r.title,
    r.featured_artist,
    r.status,
    coalesce(
      (select wm.user_id from workspace_members wm where wm.workspace_id = r.workspace_id and wm.role::text = 'owner' limit 1),
      (select wm.user_id from workspace_members wm where wm.workspace_id = r.workspace_id order by wm.created_at limit 1)
    ) as owner_id
  from releases r
  join artists a on a.id = r.artist_id
)
insert into smart_links (workspace_id, owner_id, release_id, slug, mode, headline, description, capture_email, is_active)
select
  workspace_id,
  owner_id,
  release_id,
  regexp_replace(lower(artist_name || '-' || title), '[^a-z0-9]+', '-', 'g'),
  case when status = 'upcoming' then 'presave' else 'live' end,
  artist_name || ' — ' || title || case when featured_artist is not null then ' (feat. ' || featured_artist || ')' else '' end,
  case when status = 'upcoming' then 'Get the release update and choose your preferred music service.' else 'Choose where to listen.' end,
  true,
  true
from release_rows
where owner_id is not null
on conflict (workspace_id, release_id) do update
set headline = excluded.headline,
    mode = excluded.mode,
    description = excluded.description,
    updated_at = now();

insert into smart_link_destinations (workspace_id, smart_link_id, service, url, position)
select sl.workspace_id, sl.id, 'hyperfollow', 'https://distrokid.com/hyperfollow/middlechild7/never-alone-feat-low-sunday/', 0
from smart_links sl
join releases r on r.id = sl.release_id
join artists a on a.id = r.artist_id
where r.title = 'Never Alone' and a.name = 'Middle Child'
on conflict (smart_link_id, service) do update
set url = excluded.url, updated_at = now();