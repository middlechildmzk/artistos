-- SESSION B.1: creator-scoped RLS for ai_generations.
-- Replaces the permissive USING(true) policies with created_by = auth.uid()
-- on SELECT / INSERT / UPDATE, forces created_by server-side, and blocks
-- clients from changing created_by on update. Table currently has 0 rows.
-- FUTURE: when a workspace-membership model lands, replace these with
-- workspace-scoped policies (documented in NEXT_STEPS.md).
-- ROLLBACK (restores Session B permissive policies):
--   DROP TRIGGER IF EXISTS ai_generations_lock_created_by ON public.ai_generations;
--   DROP FUNCTION IF EXISTS public.ai_generations_lock_created_by();
--   DROP POLICY IF EXISTS ai_generations_read ON public.ai_generations;
--   DROP POLICY IF EXISTS ai_generations_insert ON public.ai_generations;
--   DROP POLICY IF EXISTS ai_generations_update ON public.ai_generations;
--   CREATE POLICY ai_generations_read   ON public.ai_generations FOR SELECT TO authenticated USING (true);
--   CREATE POLICY ai_generations_insert ON public.ai_generations FOR INSERT TO authenticated WITH CHECK (true);
--   CREATE POLICY ai_generations_update ON public.ai_generations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
--   ALTER TABLE public.ai_generations ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.ai_generations ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.ai_generations ALTER COLUMN created_by SET NOT NULL;

DROP POLICY IF EXISTS ai_generations_read ON public.ai_generations;
DROP POLICY IF EXISTS ai_generations_insert ON public.ai_generations;
DROP POLICY IF EXISTS ai_generations_update ON public.ai_generations;

CREATE POLICY ai_generations_read ON public.ai_generations
  FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY ai_generations_insert ON public.ai_generations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY ai_generations_update ON public.ai_generations
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.ai_generations_lock_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_generations_lock_created_by ON public.ai_generations;
CREATE TRIGGER ai_generations_lock_created_by
  BEFORE UPDATE ON public.ai_generations
  FOR EACH ROW EXECUTE FUNCTION public.ai_generations_lock_created_by();