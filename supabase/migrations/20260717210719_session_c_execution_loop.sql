-- SESSION C: CRM execution loop schema + scoped write access.
-- Adds relationship stages and next actions to people/organizations/properties,
-- a campaign_targets join table with outcome status, and the minimum write
-- grants the app needs. Writes remain authenticated-only; fans and
-- suppressions stay READ-ONLY from the app (no grants added there).
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.campaign_targets;
--   ALTER TABLE public.people DROP COLUMN IF EXISTS relationship_stage, DROP COLUMN IF EXISTS next_action, DROP COLUMN IF EXISTS next_action_due;
--   (same for organizations, properties)
--   REVOKE INSERT, UPDATE ON public.interactions FROM authenticated;
--   REVOKE UPDATE ON public.tasks FROM authenticated;
--   REVOKE UPDATE ON public.people, public.organizations, public.properties FROM authenticated;
--   DROP POLICY IF EXISTS ... (each *_write policy below)

-- 1. Relationship stage + next action on outreach entities
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['people','organizations','properties'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS relationship_stage text NOT NULL DEFAULT ''identified'' CHECK (relationship_stage IN (''identified'',''qualified'',''pitched'',''replied'',''negotiating'',''placed'',''declined'',''dormant''))', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS next_action text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS next_action_due date', t);
  END LOOP;
END $$;

-- 2. Campaign targets with outcome tracking
CREATE TABLE IF NOT EXISTS public.campaign_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('person','organization','property')),
  target_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','pitched','replied','accepted','declined','placed')),
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (campaign_id, target_kind, target_id)
);
ALTER TABLE public.campaign_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_targets FROM anon;  -- new tables inherit default anon grants
DROP POLICY IF EXISTS campaign_targets_rw ON public.campaign_targets;
CREATE POLICY campaign_targets_rw ON public.campaign_targets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_targets TO authenticated;
CREATE INDEX IF NOT EXISTS campaign_targets_campaign_idx ON public.campaign_targets (campaign_id, status);
CREATE INDEX IF NOT EXISTS campaign_targets_target_idx ON public.campaign_targets (target_kind, target_id);

-- 3. Scoped write access for the execution loop
GRANT INSERT, UPDATE ON public.interactions TO authenticated;
DROP POLICY IF EXISTS interactions_write ON public.interactions;
CREATE POLICY interactions_write ON public.interactions
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS interactions_update ON public.interactions;
CREATE POLICY interactions_update ON public.interactions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT UPDATE (status, completed_at) ON public.tasks TO authenticated;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT UPDATE (relationship_stage, next_action, next_action_due, notes) ON public.people TO authenticated;
GRANT UPDATE (relationship_stage, next_action, next_action_due, notes) ON public.organizations TO authenticated;
GRANT UPDATE (relationship_stage, next_action, next_action_due, notes) ON public.properties TO authenticated;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['people','organizations','properties'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t||'_update', t);
  END LOOP;
END $$;