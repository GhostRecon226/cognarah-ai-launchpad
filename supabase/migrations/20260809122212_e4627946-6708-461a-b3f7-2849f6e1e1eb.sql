-- ============ articles: editorial intelligence fields ============
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS promotion_score integer,
  ADD COLUMN IF NOT EXISTS promotion_reason text,
  ADD COLUMN IF NOT EXISTS promotion_signals text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS promotion_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS newsworthiness_score integer,
  ADD COLUMN IF NOT EXISTS newsworthiness_reason text;

-- ============ article_views: first-party page view events ============
CREATE TABLE IF NOT EXISTS public.article_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  slug text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  visitor_hash text,
  referrer_host text,
  source_group text NOT NULL DEFAULT 'direct',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.article_views TO authenticated;
GRANT ALL ON public.article_views TO service_role;

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read article views"
ON public.article_views FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE INDEX IF NOT EXISTS article_views_occurred_at_idx ON public.article_views (occurred_at DESC);
CREATE INDEX IF NOT EXISTS article_views_article_idx ON public.article_views (article_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS article_views_source_idx ON public.article_views (source_group, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS article_views_dedupe_idx
  ON public.article_views (article_id, visitor_hash)
  WHERE visitor_hash IS NOT NULL;

-- ============ article_promotions: manual distribution log ============
CREATE TABLE IF NOT EXISTS public.article_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  channel text NOT NULL,
  promoted_at timestamptz NOT NULL DEFAULT now(),
  promotion_status text NOT NULL DEFAULT 'promoted',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_promotions TO authenticated;
GRANT ALL ON public.article_promotions TO service_role;

ALTER TABLE public.article_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read promotions"
ON public.article_promotions FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Staff can insert promotions"
ON public.article_promotions FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Staff can update promotions"
ON public.article_promotions FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Staff can delete promotions"
ON public.article_promotions FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE INDEX IF NOT EXISTS article_promotions_article_idx ON public.article_promotions (article_id, promoted_at DESC);

CREATE TRIGGER article_promotions_updated
BEFORE UPDATE ON public.article_promotions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ analytics start marker ============
CREATE OR REPLACE FUNCTION public.article_views_tracking_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT min(occurred_at) FROM public.article_views
$$;

REVOKE EXECUTE ON FUNCTION public.article_views_tracking_start() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.article_views_tracking_start() TO authenticated, service_role;