
CREATE TABLE public.skill_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('auto_published','manual_published','reverted_to_draft','manual_created')),
  run_id uuid NULL REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  matched_criteria jsonb NULL,
  actor_id uuid NULL,
  actor_label text NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX skill_audit_log_skill_id_idx ON public.skill_audit_log(skill_id, created_at DESC);

GRANT SELECT ON public.skill_audit_log TO authenticated;
GRANT ALL ON public.skill_audit_log TO service_role;

ALTER TABLE public.skill_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and editors can view skill audit log"
  ON public.skill_audit_log FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Admins and editors can insert skill audit log"
  ON public.skill_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));
