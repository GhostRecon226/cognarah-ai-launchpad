
-- Add entry_type distinguishing directory (external link) vs original (self-hosted)
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'original';

-- Backfill: rows with a source_url are treated as directory listings
UPDATE public.skills SET entry_type = 'directory' WHERE source_url IS NOT NULL AND entry_type = 'original';

ALTER TABLE public.skills
  DROP CONSTRAINT IF EXISTS skills_entry_type_check;
ALTER TABLE public.skills
  ADD CONSTRAINT skills_entry_type_check CHECK (entry_type IN ('directory','original'));

-- Replace old Claude Code file requirement with entry_type-aware rules.
ALTER TABLE public.skills
  DROP CONSTRAINT IF EXISTS skills_claude_code_requires_file;

ALTER TABLE public.skills
  DROP CONSTRAINT IF EXISTS skills_entry_type_fields_check;
ALTER TABLE public.skills
  ADD CONSTRAINT skills_entry_type_fields_check CHECK (
    (entry_type = 'original' AND file_url IS NOT NULL AND length(trim(file_url)) > 0)
    OR
    (entry_type = 'directory' AND source_url IS NOT NULL AND length(trim(source_url)) > 0)
  );
