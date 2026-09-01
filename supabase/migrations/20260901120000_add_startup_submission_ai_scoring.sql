-- Automated legitimacy/spam and AI-relevance scoring for startup submissions,
-- computed once at submission time (see submitStartup in
-- src/lib/startup-submissions.functions.ts). Nullable/unset columns mean
-- "not yet scored" (e.g. the Gemini call failed, or the submission predates
-- this migration), distinct from a real low score.

ALTER TABLE public.startup_submissions
  ADD COLUMN ai_legitimacy_score INTEGER,
  ADD COLUMN ai_relevance_score INTEGER,
  ADD COLUMN ai_score_reason TEXT,
  ADD COLUMN ai_flags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN ai_scored_at TIMESTAMPTZ;

ALTER TABLE public.startup_submissions
  ADD CONSTRAINT startup_submissions_ai_legitimacy_score_range
    CHECK (ai_legitimacy_score IS NULL OR (ai_legitimacy_score BETWEEN 0 AND 100)),
  ADD CONSTRAINT startup_submissions_ai_relevance_score_range
    CHECK (ai_relevance_score IS NULL OR (ai_relevance_score BETWEEN 0 AND 100));
