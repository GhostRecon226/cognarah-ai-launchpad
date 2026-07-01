
-- Cognarah AI news curation agent tables

-- 1) Agent settings (single row)
CREATE TABLE public.agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  cron_expression TEXT NOT NULL DEFAULT '0 7 * * *',
  default_count INT NOT NULL DEFAULT 2,
  default_focus TEXT,
  system_prompt TEXT,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_settings TO authenticated;
GRANT ALL ON public.agent_settings TO service_role;
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage agent_settings" ON public.agent_settings FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));
CREATE TRIGGER agent_settings_updated BEFORE UPDATE ON public.agent_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.agent_settings (enabled, cron_expression, default_count) VALUES (false, '0 7 * * *', 2);

-- 2) Trusted sources
CREATE TABLE public.agent_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'domain', -- 'domain' | 'rss' | 'url'
  value TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_sources TO authenticated;
GRANT ALL ON public.agent_sources TO service_role;
ALTER TABLE public.agent_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage agent_sources" ON public.agent_sources FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));
CREATE TRIGGER agent_sources_updated BEFORE UPDATE ON public.agent_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.agent_sources (label, kind, value) VALUES
  ('TechCrunch AI', 'domain', 'techcrunch.com'),
  ('MIT Technology Review', 'domain', 'technologyreview.com'),
  ('The Verge AI', 'domain', 'theverge.com'),
  ('VentureBeat AI', 'domain', 'venturebeat.com'),
  ('Wired AI', 'domain', 'wired.com'),
  ('Rest of World (Africa AI)', 'domain', 'restofworld.org'),
  ('Semafor Africa', 'domain', 'semafor.com');

-- 3) Runs
CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID,
  trigger TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'scheduled'
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'error'
  requested_count INT NOT NULL DEFAULT 1,
  focus TEXT,
  drafts_created INT NOT NULL DEFAULT 0,
  log TEXT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins view agent_runs" ON public.agent_runs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));
CREATE POLICY "admins modify agent_runs" ON public.agent_runs FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

-- 4) De-dup log
CREATE TABLE public.agent_seen_sources (
  url_hash TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_seen_sources TO authenticated;
GRANT ALL ON public.agent_seen_sources TO service_role;
ALTER TABLE public.agent_seen_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage seen_sources" ON public.agent_seen_sources FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

-- 5) Extend articles with agent metadata
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_urls TEXT[] NOT NULL DEFAULT '{}';

-- 6) Seed Cognarah AI author
INSERT INTO public.authors (slug, name, bio)
VALUES ('cognarah-ai', 'Cognarah AI', 'AI-assisted news curation. Every story is reviewed by our editors before publication.')
ON CONFLICT (slug) DO NOTHING;
