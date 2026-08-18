CREATE TYPE public.ad_placement AS ENUM ('startups_listing_top', 'article_inline');

CREATE TABLE public.sponsored_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name text NOT NULL,
  image_url text NOT NULL,
  destination_url text NOT NULL,
  placement public.ad_placement NOT NULL,
  start_date date NOT NULL DEFAULT current_date,
  end_date date NOT NULL DEFAULT (current_date + 30),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sponsored_ads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsored_ads TO authenticated;
GRANT ALL ON public.sponsored_ads TO service_role;

ALTER TABLE public.sponsored_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view live sponsored ads"
ON public.sponsored_ads FOR SELECT TO anon, authenticated
USING (active = true AND start_date <= current_date AND end_date >= current_date);

CREATE POLICY "Staff can view all sponsored ads"
ON public.sponsored_ads FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Staff can insert sponsored ads"
ON public.sponsored_ads FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Staff can update sponsored ads"
ON public.sponsored_ads FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Staff can delete sponsored ads"
ON public.sponsored_ads FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE TRIGGER sponsored_ads_updated
BEFORE UPDATE ON public.sponsored_ads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX sponsored_ads_placement_idx ON public.sponsored_ads (placement, active, start_date, end_date);