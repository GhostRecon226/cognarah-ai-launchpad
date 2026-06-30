
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;

-- Articles
DROP POLICY IF EXISTS "Admins read all articles" ON public.articles;
DROP POLICY IF EXISTS "Admins manage articles" ON public.articles;

CREATE POLICY "Staff read all articles" ON public.articles FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Authors read own articles" ON public.articles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'author') AND author_user_id = auth.uid());

CREATE POLICY "Staff insert articles" ON public.articles FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Authors insert own drafts" ON public.articles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'author') AND author_user_id = auth.uid() AND status = 'draft');

CREATE POLICY "Staff update articles" ON public.articles FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

CREATE POLICY "Authors update own drafts" ON public.articles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'author') AND author_user_id = auth.uid() AND status = 'draft')
WITH CHECK (public.has_role(auth.uid(), 'author') AND author_user_id = auth.uid() AND status = 'draft');

CREATE POLICY "Staff delete articles" ON public.articles FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

-- Categories
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Staff manage categories" ON public.categories FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

-- Authors
DROP POLICY IF EXISTS "Admins manage authors" ON public.authors;
CREATE POLICY "Staff manage authors" ON public.authors FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));

-- user_roles writes
CREATE POLICY "Admins insert roles" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update roles" ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Storage
DROP POLICY IF EXISTS "Admins upload media" ON storage.objects;
DROP POLICY IF EXISTS "Admins update media" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete media" ON storage.objects;

CREATE POLICY "Staff upload media" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media' AND public.has_any_role(auth.uid(), ARRAY['admin','editor','author']::app_role[]));
CREATE POLICY "Staff update media" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'media' AND public.has_any_role(auth.uid(), ARRAY['admin','editor','author']::app_role[]));
CREATE POLICY "Editors delete media" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media' AND public.has_any_role(auth.uid(), ARRAY['admin','editor']::app_role[]));
