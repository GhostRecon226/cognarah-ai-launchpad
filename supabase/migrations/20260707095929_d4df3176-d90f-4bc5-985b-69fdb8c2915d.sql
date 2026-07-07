ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS key_takeaways text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_news boolean NOT NULL DEFAULT true;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS long_intro text;