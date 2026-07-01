ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_article_views(_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.articles SET view_count = view_count + 1 WHERE slug = _slug AND status = 'published';
$$;

GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO anon, authenticated;