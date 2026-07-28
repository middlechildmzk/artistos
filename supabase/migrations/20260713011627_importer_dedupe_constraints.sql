-- Support idempotent playlist/property imports
create unique index if not exists properties_url_idx on properties (lower(url)) where url is not null;
create unique index if not exists properties_name_noturl_idx on properties (lower(name)) where url is null;
