
-- 1. Split skills read policy so anonymous visitors never need the role helpers
DROP POLICY IF EXISTS "Public can read published skills" ON public.skills;

CREATE POLICY "Anon can read published skills"
ON public.skills FOR SELECT TO anon
USING (published = true);

CREATE POLICY "Users can read published skills"
ON public.skills FOR SELECT TO authenticated
USING (published = true OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'editor'::app_role]));

-- 2. Role helpers: only allow checking the caller's own roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = ANY(_roles)
    )
  END
$$;

-- 3. Revoke execute from anonymous callers
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated, service_role;
