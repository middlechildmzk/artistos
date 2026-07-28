CREATE TABLE IF NOT EXISTS industry_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  first_name text,
  contact_type text,
  segment text,
  consent_status text,
  verification_status text,
  location text,
  genres text,
  links text,
  source_files text,
  source_sheet text,
  source_row integer,
  import_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS industry_contacts_email_lower_uidx ON industry_contacts (lower(email));

CREATE TABLE IF NOT EXISTS playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  curator text,
  genres text,
  followers_legacy text,
  contact_emails text,
  spotify_url text,
  verification_status text,
  source_sheet text,
  source_row integer,
  source_note text,
  import_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS playlists_spotify_url_uidx ON playlists (spotify_url);
