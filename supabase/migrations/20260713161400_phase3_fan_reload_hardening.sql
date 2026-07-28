ALTER TABLE fans ADD COLUMN IF NOT EXISTS source_row integer;
ALTER TABLE fans ADD COLUMN IF NOT EXISTS source_sheet text;
CREATE UNIQUE INDEX IF NOT EXISTS fans_email_lower_uidx ON fans (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS suppressions_email_lower_uidx ON suppressions (lower(email));
