
REVOKE ALL ON FUNCTION public.increment_article_views(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO service_role;
