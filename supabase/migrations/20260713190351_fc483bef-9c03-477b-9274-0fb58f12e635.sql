
ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS auto_publish_paused boolean NOT NULL DEFAULT false;

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS auto_published_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_review_count integer NOT NULL DEFAULT 0;
