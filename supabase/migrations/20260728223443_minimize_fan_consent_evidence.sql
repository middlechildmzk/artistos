alter table fan_consents
  drop column if exists ip_hash,
  drop column if exists user_agent_hash;

comment on table fan_consents is 'Append-only consent evidence containing the explicit action, policy version, timestamp, source page, smart-link attribution and campaign attribution. Email identity remains unverified until a confirmation workflow succeeds.';