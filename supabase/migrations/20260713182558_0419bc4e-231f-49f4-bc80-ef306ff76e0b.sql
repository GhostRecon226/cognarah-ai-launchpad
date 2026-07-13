
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_attribution TEXT;
