DROP POLICY IF EXISTS "Admins can view submissions" ON public.startup_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON public.startup_submissions;
DROP POLICY IF EXISTS "Admins can delete submissions" ON public.startup_submissions;

CREATE POLICY "Admins and editors can view submissions"
  ON public.startup_submissions FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Admins and editors can update submissions"
  ON public.startup_submissions FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Admins can delete submissions"
  ON public.startup_submissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
