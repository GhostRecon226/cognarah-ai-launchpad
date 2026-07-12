
CREATE TYPE public.skill_category AS ENUM ('Claude Code','Prompt Engineering','Automation','Workflow','Other');
CREATE TYPE public.skill_difficulty AS ENUM ('Beginner','Intermediate','Advanced');

CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  category public.skill_category NOT NULL,
  difficulty public.skill_difficulty NOT NULL,
  content text NOT NULL,
  file_url text,
  author text NOT NULL DEFAULT 'Cognarah Team',
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.skills TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published skills"
  ON public.skills FOR SELECT
  USING (published = true OR public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Admins and editors can insert skills"
  ON public.skills FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Admins and editors can update skills"
  ON public.skills FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Admins and editors can delete skills"
  ON public.skills FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE TRIGGER skills_set_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX skills_published_created_at_idx ON public.skills (published, created_at DESC);

-- Storage policies for skills-files bucket (private)
CREATE POLICY "Admins and editors can upload skill files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'skills-files' AND public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Admins and editors can update skill files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'skills-files' AND public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Admins and editors can delete skill files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'skills-files' AND public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Admins and editors can read skill files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'skills-files' AND public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));
