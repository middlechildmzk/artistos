-- SESSION B: AI generation audit log. Every AI draft is recorded with
-- prompt version, model/provider, context refs, output, edits, approval
-- state, final text, errors, and usage. No automatic sending exists;
-- approval_state gates everything. Authenticated-only RLS.
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  mode text NOT NULL CHECK (mode IN ('pitch','followup','strategist','campaign','focus')),
  prompt_version text NOT NULL DEFAULT 'v1',
  provider text,
  model text,
  live_ai boolean NOT NULL DEFAULT false,
  target_kind text,            -- 'person' | 'property' | 'organization' | 'interaction' | null
  target_id uuid,
  context_ref jsonb,           -- ids + fields supplied to the model (no invented data)
  input_prompt text,
  output_text text,
  edited_text text,
  approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft','approved','rejected')),
  final_text text,
  error text,
  usage jsonb
);
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_generations_read ON public.ai_generations;
DROP POLICY IF EXISTS ai_generations_insert ON public.ai_generations;
DROP POLICY IF EXISTS ai_generations_update ON public.ai_generations;
CREATE POLICY ai_generations_read   ON public.ai_generations FOR SELECT TO authenticated USING (true);
CREATE POLICY ai_generations_insert ON public.ai_generations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ai_generations_update ON public.ai_generations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.ai_generations TO authenticated;
CREATE INDEX IF NOT EXISTS ai_generations_target_idx ON public.ai_generations (target_kind, target_id);
CREATE INDEX IF NOT EXISTS ai_generations_state_idx ON public.ai_generations (approval_state, created_at DESC);