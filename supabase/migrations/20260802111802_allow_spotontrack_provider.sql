begin;

alter table public.oauth_connections
  drop constraint if exists oauth_connections_provider_check;

alter table public.oauth_connections
  add constraint oauth_connections_provider_check
  check (provider = any (array[
    'google'::text,
    'spotify'::text,
    'soundcharts'::text,
    'kit'::text,
    'lastfm'::text,
    'ticketmaster'::text,
    'spotontrack'::text
  ]));

commit;