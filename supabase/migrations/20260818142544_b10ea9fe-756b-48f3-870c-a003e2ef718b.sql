CREATE POLICY "Staff can read sponsored ad files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sponsored-ads' AND public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Staff can upload sponsored ad files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sponsored-ads' AND public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Staff can update sponsored ad files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sponsored-ads' AND public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Staff can delete sponsored ad files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sponsored-ads' AND public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));