CREATE TABLE public.article_translations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  translated_title text NOT NULL,
  translated_body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (article_id, language_code)
);

CREATE INDEX article_translations_article_lang_idx ON public.article_translations (article_id, language_code);

GRANT SELECT ON public.article_translations TO anon;
GRANT SELECT ON public.article_translations TO authenticated;
GRANT ALL ON public.article_translations TO service_role;

ALTER TABLE public.article_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached translations"
ON public.article_translations FOR SELECT
TO anon, authenticated
USING (true);