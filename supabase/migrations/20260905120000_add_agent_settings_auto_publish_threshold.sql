-- Score-gated auto-publish for the news agent (src/lib/agent-core.server.ts),
-- mirroring the tier-based auto-publish already used by the skills agent
-- (agent_settings.auto_publish_paused, agent_runs.auto_published_count /
-- manual_review_count already exist from an earlier migration).
--
-- NULL = auto-publish disabled (every draft stays a draft, today's
-- behavior). A number = the minimum newsworthiness score (0-100, the sum
-- of 4 sub-scores) a candidate needs to publish immediately instead of
-- landing as a draft for review. Defaulted to 70, not left NULL: see
-- LOVABLE-MIGRATION.md / the commit introducing this column for the
-- reasoning behind that starting value.
ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS auto_publish_threshold integer DEFAULT 70;

ALTER TABLE public.agent_settings
  ADD CONSTRAINT agent_settings_auto_publish_threshold_range
    CHECK (auto_publish_threshold IS NULL OR (auto_publish_threshold BETWEEN 0 AND 100));
