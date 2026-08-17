CREATE TABLE public.translation_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  language_code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX translation_requests_ip_time_idx ON public.translation_requests (ip_hash, created_at DESC);

GRANT ALL ON public.translation_requests TO service_role;

ALTER TABLE public.translation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to translation request log"
ON public.translation_requests FOR SELECT
TO anon, authenticated
USING (false);