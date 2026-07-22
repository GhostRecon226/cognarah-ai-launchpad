
ALTER TABLE public.startup_submissions
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS company_linkedin text,
  ADD COLUMN IF NOT EXISTS twitter_handle text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS mission text,
  ADD COLUMN IF NOT EXISTS differentiator text,
  ADD COLUMN IF NOT EXISTS competitors text,
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS pricing_model text,
  ADD COLUMN IF NOT EXISTS markets_served text[],
  ADD COLUMN IF NOT EXISTS cofounders jsonb,
  ADD COLUMN IF NOT EXISTS key_team_members text,
  ADD COLUMN IF NOT EXISTS milestones text,
  ADD COLUMN IF NOT EXISTS awards text,
  ADD COLUMN IF NOT EXISTS screenshot_urls text[],
  ADD COLUMN IF NOT EXISTS pitch_video_url text,
  ADD COLUMN IF NOT EXISTS roadmap text;
