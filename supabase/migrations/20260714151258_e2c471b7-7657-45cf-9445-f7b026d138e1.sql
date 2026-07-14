ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS stars_count integer,
  ADD COLUMN IF NOT EXISTS last_updated date,
  ADD COLUMN IF NOT EXISTS bundled_files text[];