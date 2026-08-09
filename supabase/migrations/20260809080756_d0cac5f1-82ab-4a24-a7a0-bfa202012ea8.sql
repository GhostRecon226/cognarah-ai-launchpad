ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS africa_relevance_score integer,
  ADD COLUMN IF NOT EXISTS africa_relevance_reason text,
  ADD COLUMN IF NOT EXISTS africa_evidence text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS africa_angle_used boolean,
  ADD COLUMN IF NOT EXISTS africa_angle_type text;

ALTER TABLE public.articles
  ADD CONSTRAINT articles_africa_relevance_score_range
  CHECK (africa_relevance_score IS NULL OR (africa_relevance_score >= 0 AND africa_relevance_score <= 5));