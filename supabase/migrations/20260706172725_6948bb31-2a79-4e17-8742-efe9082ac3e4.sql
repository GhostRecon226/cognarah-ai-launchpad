DO $$ BEGIN
  CREATE TYPE public.startup_submission_status AS ENUM ('pending','approved','rejected','published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.startup_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.startup_submission_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,

  company_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  year_founded INTEGER NOT NULL,
  company_stage TEXT NOT NULL,

  product_description TEXT NOT NULL,
  problem_solved TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  ai_technologies TEXT[] NOT NULL DEFAULT '{}',

  founder_name TEXT NOT NULL,
  founder_linkedin TEXT,
  team_size TEXT NOT NULL,

  user_count TEXT,
  revenue_stage TEXT NOT NULL,
  funding_raised TEXT,
  notable_investors TEXT,
  partnerships TEXT,

  logo_url TEXT NOT NULL,
  product_demo TEXT,
  press_links TEXT,

  founder_email TEXT NOT NULL,
  contact_method TEXT NOT NULL,
  whatsapp_number TEXT,

  consent BOOLEAN NOT NULL DEFAULT false
);

GRANT INSERT ON public.startup_submissions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.startup_submissions TO authenticated;
GRANT ALL ON public.startup_submissions TO service_role;

ALTER TABLE public.startup_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a startup"
  ON public.startup_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (consent = true);

CREATE POLICY "Admins can view submissions"
  ON public.startup_submissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update submissions"
  ON public.startup_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete submissions"
  ON public.startup_submissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_startup_submissions_updated_at
  BEFORE UPDATE ON public.startup_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
